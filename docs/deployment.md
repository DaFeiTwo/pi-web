# 分支模型与部署说明

本仓库是 fork，采用「双分支」职责分离：

| 分支 | 职责 | 特点 |
| --- | --- | --- |
| `main` | 跟随上游 fork 仓库的代码（同步上游更新） | 保持与上游一致，不放部署相关改动 |
| `deploy` | 部署分支：通过阿里云 ACR 在线构建镜像，再推到服务器上用 Docker 运行 | `main` + 部署改动 + 自己开发的功能；通过 merge 吸收 `main` 的更新，从不强推 |
| `feat/*` 等 | 自己的功能开发分支 | 从 `deploy` 拉出，开发完提 PR 合回 `deploy` |

```
upstream/main ──Sync fork──▶ main（纯镜像，不改）
                               │ git merge main（普通 push）
                               ▼
feat/xxx ──PR──────────────▶ deploy ──push 触发──▶ ACR 构建 ──▶ ECS
```

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

## 2. `deploy`：`main` + 部署改动 + 自己的功能

`deploy` = 最新 `main` + 下面这些只属于本 fork 的改动：

- `Dockerfile`、`.dockerignore` —— 我们自己的容器构建配置。上游现在也有这两个文件，但内容不同（上游用 `HOME=/home/node`、`node` 用户、剪掉 dev 依赖），**`deploy` 上始终保留我们的版本**，否则线上 `/data` 卷里的会话、凭据、模型配置会读不到。
- `docker-compose.yml` —— 仓库里这份只是参考；**服务器上实际用的是另一份**，和仓库里的不同。上游的 `compose.yaml`（按源码构建）也会随 `main` 进入 `deploy`，服务器上用不到它。
- 自己开发的功能（如新会话页 "Pi Web" 旁的 GitHub 源码链接），通过 PR 合入。

### 用 merge 让 deploy 吸收 main 的更新

`deploy` **不再 rebase、不再强推**。原因：rebase 会改写已合并 PR 的提交，开着的 PR 也会对不上基线。merge 只需处理这一次新出现的冲突，普通 push 即可。

```bash
# 0) 先确保 main 已同步到最新（见上一节）

# 1) 更新本地 deploy
git checkout deploy
git pull

# 2) 把 main 合进来
git merge main
#   如有冲突：解决后 git add <文件> && git commit
#   要放弃：git merge --abort
#   冲突规则：Dockerfile / .dockerignore 保留我们的版本（git checkout --ours <文件>）；
#   其他文件以上游为主，把我们的改动融进去。

# 3) 本地验证（建议）
node_modules/.bin/tsc --noEmit        # package.json 依赖有变化时先 npm ci
git log --oneline main..deploy --no-merges   # 只列出我们自己的提交

# 4) 普通 push（会触发 ACR 构建）
git push origin deploy
```

查看本 fork 相对上游改了什么：

```bash
git diff main...deploy                    # 全部差异
git log --oneline main..deploy --no-merges   # 自己的提交
```

> 可选：`git config rerere.enabled true` 让 git 记住解决过的冲突，同样的冲突再次出现时自动套用。

### 开发自己的功能

```bash
git checkout deploy && git pull
git checkout -b feat/xxx
# ... 开发、提交 ...
git push -u origin feat/xxx
# GitHub 上开 PR：feat/xxx → deploy（合并方式建议选 Squash），合并后自动触发部署
```

- `feat/xxx` 开发期间想跟上 `deploy` 最新代码，在它上面 rebase 或 merge 都可以（它是自己的分支）。
- 合并后删掉 `feat/xxx`，下次开发重新从 `deploy` 拉。

减少同步冲突的做法（比选 rebase 还是 merge 影响更大）：

1. 新功能尽量写在新文件里，上游常改的文件（`ChatWindow.tsx`、`SessionSidebar.tsx`、`globals.css`）里只留一两行引用。
2. 能用 pi 扩展或 skill 实现的，就别改 pi-web 源码，扩展放在 `~/.pi` 下，不会冲突。
3. 通用改进提 PR 给上游 `agegr/pi-web`，被接受后就不用自己维护。
4. 配置项尽量走环境变量（如上游已支持的 `PI_WEB_APP_NAME`），别写死在代码里。

---

## 3. 阿里云 ACR 构建 + 服务器部署

### 镜像

真实 ACR 地址不提交到仓库，只放在服务器的 `.env`：

```dotenv
PI_WEB_IMAGE=<your-registry-host>/<namespace>/pi-web:latest
```

`docker-compose.yml` 通过 `${PI_WEB_IMAGE}` 读取完整镜像地址；密码和代理域名也分别通过 `${PI_WEB_PASSWORD}`、`${PI_WEB_ALLOWED_HOSTS}` 读取。三个变量为空时 Compose 会拒绝启动。

### 构建（阿里云 ACR 自动构建）

ACR **已绑定 `deploy` 分支**：只要 `deploy` 有新 push，ACR 就会自动用 `Dockerfile` 在线构建镜像并推到上面的仓库地址，**tag 固定为 `latest`**。也就是说发布不需要手动点构建，`git push` 到 deploy 之后等 ACR 构建完成即可。

`Dockerfile` 采用两阶段构建（`node:22-bookworm-slim`）：

- **build 阶段**：`npm ci` 装全量依赖（`next build` 需要 devDependencies），然后 `npm run build`。
- **runtime 阶段**：装 `git` + `ca-certificates`（in-process agent 会 shell out 调 git、走 HTTPS 调 LLM），拷贝运行 `next start` 所需产物。
- **重要**：**不能** `npm prune --omit=dev`。`next start` 运行时用 `jiti` 解析 `next.config.ts`，`jiti` 是 devDependency，剪掉会导致启动报 `Cannot find module 'jiti'`。

镜像默认：端口 `30141`，`PI_WEB_HOSTNAME=0.0.0.0`，`HOME=/data`（pi 的状态都写在 `$HOME` 下）。

### 在服务器（阿里云 ECS）上运行

```bash
# 拉最新镜像并后台启动（镜像变了会自动用新镜像重建容器）
docker compose pull
docker compose up -d

# 检查
docker compose ps
docker compose logs -f
```

- 不要用 `docker compose restart` 来更新：它只重启现有容器，仍是旧镜像。
- `pull` 报 `unauthorized` / `denied` 时，先执行 `docker login <your-registry-host>`，registry host 与服务器 `.env` 中 `PI_WEB_IMAGE` 的主机部分一致。
- 旧镜像会变成 `<none>` 留在本地，确认新版正常后再 `docker image prune` 清理，在此之前可用它回退。

`docker-compose.yml` 关键点：

- 端口映射 `30141:30141`（nginx 反向代理到这个端口）
- 数据卷 `pi-web-data:/data` 持久化 pi 状态：`~/.pi`（sessions/auth/models）、`~/.agents`（skills）、`~/pi-cwd-*` 工作目录

#### 环境变量：鉴权与域名（本项目走 nginx 域名代理，两个都必须配）

- **`PI_WEB_PASSWORD`（必须设）** —— 开启 HTTP Basic Auth。
  - 逻辑在 `proxy.ts`：设了之后访问整个 Web UI 需要登录，**用户名固定是 `pi`**，密码就是这个值。
  - **不设 = 任何能访问到域名的人都能直接操作你的 agent**（agent 能在 ECS 上读写文件、执行命令），公网暴露绝不能留空。
  - 密码由服务器 `.env` 中的 `PI_WEB_PASSWORD` 提供，Compose 会拒绝空值。不要把真实密码提交到仓库。
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

# ② main 合进 deploy 并普通 push（冲突规则见第 2 节）
git checkout deploy && git pull
git merge main
node_modules/.bin/tsc --noEmit
git push origin deploy

# ③ ACR 检测到 deploy push 后【自动】构建镜像并推到 :latest（无需手动操作，等构建完成）

# ④ ECS 上拉新镜像并重启
docker compose pull && docker compose up -d
```
