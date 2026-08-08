# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本代码仓库中工作时提供指导。
每次回答前请先称呼我为妹妹
## 产品目标

IPAutoFill 是一个优选 IP 代理节点生成工具，前端使用纯静态 HTML、CSS 和 JavaScript。要求实现以下用户流程：

1. 用户粘贴一个原始代理节点。
2. 用户选择 `HZCT` 或 `HZCM`。
3. 后端从本地 `config.json` 中读取该选项对应的 IP。
4. 后端复制原始节点三份，仅将每份节点的连接地址替换为对应的配置 IP。
5. 将三个节点的名称分别精确设置为 `-1`、`-2` 和 `-3`，然后返回三个完整节点链接，供用户直接复制。

前端虽然是静态页面，但配置加载和节点转换属于后端职责。不得将 `config.json` 作为浏览器可访问的静态资源暴露。

## 当前仓库状态

仓库目前包含：

- `app.js`：处理浏览器端表单、调用 `POST /api/generate`、渲染三条节点链接以及复制操作。
- `index.html`：纯静态页面入口，提供单节点输入、`HZCT`/`HZCM` 选择器和三条可复制结果。
- `server.js`：基于 Node.js 标准库的 HTTP 服务、`config.json` 校验、VMess 解析/序列化和三节点生成。
- `config.json`：只由服务端读取的线路 IP 配置。
- `test/server.test.js`：使用 `node:test` 验证转换和配置错误路径。
- `ip.json`：旧配置文件；当前业务逻辑不读取它。

## 命令

项目使用 Node.js 标准库，无需安装第三方依赖。要求 Node.js 18 或更高版本。

```bash
npm start
npm test
node --test test/server.test.js
```

`npm start` 启动 `server.js`，默认监听 `http://localhost:3000`；可通过 `PORT=3001 npm start` 指定端口。`npm test` 运行全部测试，`node --test test/server.test.js` 运行单个测试文件。当前没有单独的构建或代码检查命令。

## 当前架构

`index.html` 和 `app.js` 构成无框架的静态前端。页面仅接受一条 VMess 链接和 `HZCT`/`HZCM` 选择器，向 `POST /api/generate` 发送：

```json
{
  "nodeLink": "vmess://...",
  "profile": "HZCT"
}
```

`app.js` 使用 DOM API 与 `textContent` 渲染后端返回的三条可复制链接，不再依赖二维码或旧订阅地址接口。

`server.js` 只公开 `GET /`、`GET /app.js` 和 `POST /api/generate`；不要扩大静态资源白名单，特别是不得提供 `config.json` 或 `ip.json`。配置由服务端读取，选择器只接受 `HZCT`、`HZCM`。当前实现只支持 VMess Base64 JSON 链接：解析字段 `add` 和 `ps`，复制三份后将其分别设置为配置中的前三个 IP 和精确名称 `-1`、`-2`、`-3`，并重新序列化为 `vmess://` 链接。

`config.json` 的现有结构是以 `HZCT` 与 `HZCM` 为键、按顺序存放 IP 的数组。第 1、2、3 个 IP 分别对应 `-1`、`-2`、`-3`。配置读取、JSON 解析、数组结构、IP 格式或数量校验失败必须显式报错，且不得回退读取 `ip.json`。

若要扩展其他节点协议，为协议分别实现配对的解析器和序列化器。不得对编码后的链接执行字符串替换。

## 节点转换约束

只替换 VMess JSON 的连接地址字段 `add` 和节点名称字段 `ps`。除非协议解析和重新序列化本身要求编码规范化，否则端口、UUID/凭据、传输层、路径、Host、TLS SNI 和其余字段必须保持不变。连接地址、传输层 Host 与 TLS SNI 是不同字段，不得混淆。

## 前端约束

前端必须保持无框架，并能作为纯静态 HTML、CSS 和 JavaScript 使用。后端返回的结果通过 DOM API 写入页面；不要为结果数据引入未经转义的 `innerHTML`。保留 Clipboard API 的复制功能及其回退路径。

## 验证要求

完成实现后，应通过解码后的字段验证转换结果。一个有效原始节点配合任一选择器必须生成且仅生成三个有效链接；名称必须分别精确等于 `-1`、`-2` 和 `-3`；连接地址必须按照确定顺序匹配后端选出的三个 IP；所有无关字段必须与原始节点保持一致。同时应验证以下情况会返回明确错误：节点格式错误、选择器不受支持、`config.json` 缺失或格式无效，以及有效 IP 数量不足三个。
