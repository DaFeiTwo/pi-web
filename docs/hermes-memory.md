# 记忆页面（pi-hermes-memory 查看器）

本 fork 独有的功能，只在 `deploy` 分支，上游 `main` 没有。用来在网页上只读查看 [pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory) 插件自动生成的记忆，不用再登录服务器看文件。

## 入口

- 侧栏底部的「记忆」按钮，打开 `/memory` 页面。按钮是普通链接，可以中键或右键在新标签页打开。
- 页面有三个标签：长期记忆（`MEMORY.md`）、用户画像（`USER.md`）、失败记录（`failures.md`）。`?tab=user` / `?tab=failures` 会写进地址栏，刷新后保持当前标签。
- 条目按插件的 `§` 分隔符拆成卡片，并用 Markdown 渲染；「原文」切换显示文件的原始内容。
- 每条末尾的 `<!-- created=…, last=… -->` 会读出来显示在卡片右上角（两个日期相同时只显示一个），不出现在正文里。
- 开头形如 `环境事实：`、`工具坑:` 的短分类（冒号前 1～12 个字符、不含空格）显示为标签；`https://` 这类地址不会被当成分类。
- 点「刷新」，或页面重新回到前台时，会重新读取文件。

## 读取哪里

- 目录：插件配置 `<agentDir>/hermes-memory-config.json` 里的 `memoryDir`（支持 `~` 和相对 agentDir 的路径），没有配置时为 `<agentDir>/pi-hermes-memory`。`agentDir` 来自 pi SDK 的 `getAgentDir()`，容器里是 `/data/.pi/agent`。
- 只读这三个固定文件，每个最多 1 MiB。浏览器不传任何路径，接口也不返回服务器路径。
- 链接到目录外的符号链接、非普通文件会显示为「无法读取」。
- 第一版不读 `sessions.db`、项目记忆（`projects-memory/`）和 `skills/`。

## 安全

- `GET /api/hermes-memory` 是唯一的数据接口，只读，`Cache-Control: no-store`。
- `/memory` 页面和接口都在 `proxy.ts` 的 matcher 里，受 `PI_WEB_PASSWORD` 保护；未登录访问页面会跳到登录页。
- 没有把 agent 目录加进通用文件接口 `/api/files` 的允许范围（那里有 auth、settings 等敏感文件，而且文件接口能上传写入）。
- 记忆内容由模型写入，所以 Markdown 图片会转成链接、`<img>` 等标签显示为文本，打开页面不会请求外部地址。

## 文件

自己的目录（上游合并不会冲突）：

- `app/memory/page.tsx`：页面
- `app/api/hermes-memory/route.ts`：只读接口
- `lib/hermes-memory/server.ts`：定位目录、读取文件
- `lib/hermes-memory/documents.ts`：文档列表、条目拆分、媒体处理（客户端可用）
- `lib/hermes-memory/messages.ts`：页面自己的中英文案，不改共享的 `lib/i18n` 文件
- `components/hermes-memory/`：页面组件、侧栏按钮、样式（类名都以 `hm-` 开头）

改动的上游文件（merge `main` 时如有冲突，按这几处重新加上即可）：

- `components/AppShell.tsx`：一行 import，侧栏底部加 `<MemoryEntryButton />`
- `proxy.ts`：matcher 加 `"/memory"`
