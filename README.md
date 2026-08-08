# IPAutoFill

优选 IP 自动填充工具：输入一条 VMess 节点，选择线路（`HZCT` / `HZCM`）后，自动生成三个仅替换连接地址的节点副本，名称保留原主体并将末尾序号规范为 `-1`、`-2`、`-3`，支持一键复制全部。

- 纯静态 HTML / CSS / JavaScript，无框架、无构建步骤
- 支持 **VMess Base64 JSON**（`vmess://<Base64(JSON)>`）与 **VMess URI**（`vmess://<Base64(user@host:port)>?path=...&remarks=...`）两种格式
- 转换在浏览器本地完成，无需服务端，页面可直接部署到 Cloudflare Pages
- 除连接地址与节点名称外，其余字段（端口、UUID、传输参数、Host、SNI、path、obfs 等）原样保留

## 目录结构

```text
.
├── index.html            # 页面入口（Apple 风格 UI）
├── frontend.js           # 浏览器端本地转换逻辑（含内置线路 IP）
├── app.js                # 旧版前端（调用后端接口，已不再引用）
├── server.js             # 可选：Node 标准库 HTTP 服务（读取 config.json）
├── config.json           # 服务端线路 IP 配置（仅 server.js 使用）
├── ip.json               # 旧配置文件（当前业务不读取）
├── package.json          # 零依赖项目脚本
├── test/
│   └── server.test.js    # node:test 单元测试（针对服务端逻辑）
├── pubilc/               # Cloudflare Pages 静态部署目录（注意：用户指定命名）
│   ├── index.html
│   ├── frontend.js
│   └── README.md
├── 启动 IPAutoFill.command  # macOS 双击启动脚本（可选）
└── CLAUDE.md             # Claude Code 项目指导文档
```

> 提示：`pubilc` 为历史命名的拼写形式，Cloudflare Pages 部署时输出目录请填写 `pubilc`。

## 快速开始

### 方式一：纯静态（推荐）

直接用浏览器打开 `pubilc/index.html`（或 `index.html`），无需安装任何依赖：

1. 粘贴一条 VMess 节点链接；
2. 选择线路 `HZCT` 或 `HZCM`；
3. 点击「生成三个节点」；
4. 在弹出的结果窗口中逐条复制或点击「复制全部节点」。

### 方式二：本地 HTTP 服务

需要 Node.js 18 或更高版本：

```bash
# 安装依赖（本项目无第三方依赖，该步骤可省略）
npm install

# 启动服务，默认 http://localhost:3000
npm start

# 指定端口启动
PORT=3001 npm start
```

macOS 用户也可以直接双击 `启动 IPAutoFill.command`，脚本会自动检查 Node、启动服务并打开浏览器。

### 运行测试

```bash
# 运行全部测试
npm test

# 运行单个测试文件
node --test test/server.test.js
```

## 上传到 GitHub

### 1. 初始化并提交（若尚未提交）

```bash
cd IPAutoFill

# 初始化仓库（若还没有）
git init

# 添加远程仓库（将下面的地址换成你的仓库地址）
git remote add origin https://github.com/<用户名>/<仓库名>.git

# 添加全部文件并提交
git add .
git commit -m "Initial commit"
```

### 2. 推送

```bash
# 推送 main 分支到 GitHub
git push -u origin main
```

如果你需要覆盖历史或想先清理旧提交：

```bash
# 仅保留一次提交
git checkout --orphan latest_branch
git add -A
git commit -m "Initial commit"
git branch -D main
git branch -m main
git push -f origin main
```

> 注意：`git push -f` 会强制覆盖远端历史，仅在你确定需要时使用。

## 部署到 Cloudflare Pages

### 方式 A：通过 GitHub 自动部署（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages** → **Create application** → **Pages**；
2. 选择 **Connect to Git**，授权后选择 IPAutoFill 仓库；
3. 在构建设置中填写：
   - **Framework preset**：None
   - **Build command**：留空
   - **Build output directory**：`pubilc`
4. 点击 **Save and Deploy**。

完成上述步骤后，每次向 GitHub 推送提交，Cloudflare Pages 会自动重新构建并部署。

### 方式 B：直接上传文件（无需 Git）

1. 进入 **Workers & Pages** → **Create application** → **Pages**；
2. 选择 **Direct Upload**；
3. 将 `pubilc` 目录中的 `index.html` 与 `frontend.js` 两个文件拖拽上传；
4. 点击 **Deploy site**，等待部署完成。

### 方式 C：使用 Wrangler CLI

```bash
# 全局安装 wrangler（或使用 npx）
npm install -g wrangler

# 登录
wrangler login

# 部署 pubilc 目录
wrangler pages deploy pubilc --project-name ipautofill
```

### 部署后验证

- 访问 Cloudflare 提供的 `*.pages.dev` 域名；
- 确认页面可正常加载；
- 粘贴节点、选择线路、点击生成，确认弹窗与复制功能正常。

## 说明与注意事项

- 纯静态版本内置了 `HZCT` / `HZCM` 的 IP 表（见 `frontend.js` 中 `PROFILE_IPS`），这些 IP 会随页面公开展示。若需要保密线路 IP，应使用 `server.js` 的服务端模式，并自行调整部署方式（如 Cloudflare Pages Functions）。
- 当前 `config.json` 的 `HZCT` 第 2、3 个 IP 与 `frontend.js` 内置的 `PROFILE_IPS` 存在差异：前者用于 `server.js` 服务端模式，后者用于纯静态模式。修改时请同时更新两处，保持线路一致。
- `CLAUDE.md` 中记录的架构目标是「配置加载与节点转换由后端负责、不向浏览器暴露 `config.json`」；当前仓库同时提供了「纯静态本地转换」与「服务端转换」两条路径，README 仅描述实际运行方式。

## 开源协议

本项目采用 [MIT 协议](./LICENSE) 开源。你可以自由使用、修改、分发本项目，但需保留版权声明与许可文本。详见 [LICENSE](./LICENSE)。
