# 分支模型与部署说明

本仓库是 fork，采用「双分支」职责分离：

| 分支 | 职责 | 特点 |
| --- | --- | --- |
| `main` | 跟随上游 fork 仓库的代码（同步上游更新） | 保持与上游一致，不放部署相关改动 |
| `deploy` | 部署分支：通过阿里云 ACR 在线构建镜像，再推到服务器上用 Docker 运行 | 在 `main` 基础上叠加 Docker/ACR 部署所需的文件和改动 |

- `origin` = fork 仓库：`https://github.com/DaFeiTwo/pi-web.git`
- 上游父仓库（`main` 的更新来源）：`https://github.com/agegr/pi-web`（据 `package.json` 的 homepage 推断）

---

## 1. `main`：同步上游 fork

`main` 只做一件事：把上游 `agegr/pi-web` 的最新代码同步下来，不在上面做任何部署改动。

同步方式：

- **常用做法（GitHub 网页）**：在 fork 仓库页面点 **"Sync fork" → "Update branch"**，把上游 `agegr/pi-web` 的更新同步到 `origin/main`。之后本地 `git checkout main && git pull` 即可。
- **命令行（可选，需先加一次 upstream remote）**：
  ```bash
  # 只需配置一次
  git remote add upstream https://github.com/agegr/pi-web.git

  # 之后每次同步
  git checkout main
  git fetch upstream
  git merge --ff-only upstream/main   # 保持 main 与上游一致，不产生额外提交
  git push origin main
  ```

> 约定：**不要在 `main` 上提交部署相关改动**（Dockerfile、docker-compose、ACR 配置等）。这些只属于 `deploy`。

---

## 2. `deploy`：在 `main` 之上叠加部署改动

`deploy` = 最新 `main` + 下面这几类部署专属改动：

- `Dockerfile`、`.dockerignore`、`docker-compose.yml` —— 容器构建与运行配置（`main` 里不存在这些文件）
- ACR 镜像地址（写在 `docker-compose.yml` 里）
- 少量部署相关的小改动（如 sidebar 的 GitHub 源码链接）

### 用 rebase 让 deploy 追上 main（推荐流程）

因为这是**只有一人使用**的项目，`deploy` 可以放心 rebase + 强推，保持线性历史、部署改动始终叠在 `main` 顶部。

```bash
# 0) 先确保 main 已同步到最新（见上一节）

# 1) 打个备份分支，出问题能一键回退
git branch -f deploy-backup-before-rebase deploy

# 2) 切到 deploy，把部署提交重放到最新 main 之上
git checkout deploy
git rebase main
#   如有冲突：解决后 git add <文件> && git rebase --continue
#   要放弃：git rebase --abort

# 3) 本地验证（可选但建议）
git merge-base --is-ancestor main deploy; echo $?   # 输出 0 表示 main 已完整包含在 deploy 中
git log --oneline main..deploy                        # 应只剩几个部署提交，无多余 merge

# 4) 强推（--force-with-lease 更安全：远端被别人动过会拒绝）
git push --force-with-lease origin deploy

# 5) 确认无误后可删备份
git branch -D deploy-backup-before-rebase
```

> 提示：rebase 会改写 `deploy` 历史。若在别处也 checkout 过 `deploy`，需要 `git fetch && git reset --hard origin/deploy` 重新同步。单人使用无此顾虑。

---

## 3. 阿里云 ACR 构建 + 服务器部署

### 镜像

- ACR 镜像地址：
  ```
  crpi-eiqk1i70nlck3uul.cn-beijing.personal.cr.aliyuncs.com/stock_analysis/pi-web:latest
  ```
- 命名空间：`stock_analysis`，镜像名：`pi-web`，tag：`latest`

### 构建（阿里云 ACR 自动构建）

ACR **已绑定 `deploy` 分支**：只要 `deploy` 有新 push，ACR 就会自动用 `Dockerfile` 在线构建镜像并推到上面的仓库地址，**tag 固定为 `latest`**。也就是说发布不需要手动点构建，`git push` 到 deploy 之后等 ACR 构建完成即可。

`Dockerfile` 采用两阶段构建（`node:22-bookworm-slim`）：

- **build 阶段**：`npm ci` 装全量依赖（`next build` 需要 devDependencies），然后 `npm run build`。
- **runtime 阶段**：装 `git` + `ca-certificates`（in-process agent 会 shell out 调 git、走 HTTPS 调 LLM），拷贝运行 `next start` 所需产物。
- **重要**：**不能** `npm prune --omit=dev`。`next start` 运行时用 `jiti` 解析 `next.config.ts`，`jiti` 是 devDependency，剪掉会导致启动报 `Cannot find module 'jiti'`。

镜像默认：端口 `30141`，`PI_WEB_HOSTNAME=0.0.0.0`，`HOME=/data`（pi 的状态都写在 `$HOME` 下）。

### 在服务器（阿里云 ECS）上运行

```bash
# 拉最新镜像并后台启动
docker compose pull
docker compose up -d
```

`docker-compose.yml` 关键点：

- 端口映射 `30141:30141`（nginx 反向代理到这个端口）
- 数据卷 `pi-web-data:/data` 持久化 pi 状态：`~/.pi`（sessions/auth/models）、`~/.agents`（skills）、`~/pi-cwd-*` 工作目录

#### 环境变量：鉴权与域名（本项目走 nginx 域名代理，两个都必须配）

- **`PI_WEB_PASSWORD`（必须设）** —— 开启 HTTP Basic Auth。
  - 逻辑在 `proxy.ts`：设了之后访问整个 Web UI 需要登录，**用户名固定是 `pi`**，密码就是这个值。
  - **不设 = 任何能访问到域名的人都能直接操作你的 agent**（agent 能在 ECS 上读写文件、执行命令），公网暴露绝不能留空。
  - compose 里当前是占位符 `change-me-to-a-long-random-secret`，部署前改成一段长随机串。
  - 它是明文 Basic Auth，**务必让 nginx 终止 HTTPS**，否则密码等于明文过网络。

- **`PI_WEB_ALLOWED_HOSTS`（走 nginx/域名代理必须设）** —— 逗号分隔的精确域名白名单（`lib/request-security.ts` 读取）。
  - 把对外域名填进去，例如 `PI_WEB_ALLOWED_HOSTS=pi.example.com`；否则经 nginx 转发过来的请求会被安全校验挡掉。
  - 用裸 IP 直连才不需要；本项目用域名代理，所以必须配。

#### nginx 反代要点

- 终止 HTTPS（证书在 nginx 侧），再 `proxy_pass http://127.0.0.1:30141;`
- 转发原始 Host 头：`proxy_set_header Host $host;`（要与 `PI_WEB_ALLOWED_HOSTS` 里的域名一致）
- SSE（`/api/agent/[id]/events` 等）需要关闭缓冲：`proxy_buffering off;`、`proxy_read_timeout` 调大、`proxy_set_header Connection "";`（HTTP/1.1）

---

## 4. 一次完整的发布流程（速查）

```bash
# ① 同步上游到 main（通常在 GitHub 网页点 "Sync fork"，然后本地 pull）
git checkout main && git pull
#   或命令行：git fetch upstream && git merge --ff-only upstream/main && git push origin main

# ② deploy rebase 到最新 main 并强推
git branch -f deploy-backup-before-rebase deploy
git checkout deploy && git rebase main
git push --force-with-lease origin deploy

# ③ ACR 检测到 deploy push 后【自动】构建镜像并推到 :latest（无需手动操作，等构建完成）

# ④ ECS 上拉新镜像并重启
docker compose pull && docker compose up -d
```
