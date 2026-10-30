# bun-ws

基于 Bun 运行时的 WebSocket 代理工具集：

- **`server/`** — VLESS-over-WebSocket 代理服务器（原项目）。
- **`client/`** — 独立的 VLESS 客户端，在本地提供 SOCKS5 / SOCKS4 / HTTP 代理，通过 JSON 配置文件启动。
- **`scripts/`** — 本地集成测试（keepalive、echo、HTTP 代理、大流量传输）。

## 环境要求

- [Bun](https://bun.sh) 1.0.0 或更高版本
- 无第三方运行时依赖

## 快速开始

```bash
# 安装 Bun（如未安装）
curl -fsSL https://bun.sh/install | bash

git clone https://github.com/yixunbfb/bun-ws.git
cd bun-ws

# 启动服务器
bun run start          # 即 bun run server/index.ts
bun run dev            # 监听文件变化自动重启

# 启动客户端（默认读取 client/config.json）
bun run client
```

## 服务器

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8333` | 监听端口 |
| `UUID` | `8ea48d91-eab2-4dfa-9169-859b0d43b3dc` | 身份验证 UUID（VLESS ID） |
| `WSPATH` | UUID 前 8 位 | WebSocket 路径 |

复制 `.env.example` 为 `.env` 后按需修改。

### 接口

- `GET /health` — 健康检查（`200 ok`）
- `WS /<WSPATH>` — VLESS-over-WebSocket 代理入口

服务器仅支持 VLESS TCP 请求，不再提供订阅接口，也不再支持 Trojan。

## 客户端

客户端是单文件脚本 `client/bun-vlessclient.ts`，通过 WebSocket 连接 VLESS 服务器，
并在 `local_port` 上提供本地 SOCKS5 代理（同时自动识别 SOCKS4/SOCKS4a 与 HTTP 代理）。

### 配置文件

默认加载 `client/config.json`。先复制示例再修改：

```bash
cp client/config.example.json client/config.json
```

```jsonc
{
  "log_level": "info",              // debug | info | warn | error | none
  "local_port": 1080,               // 本地代理端口
  "timeout": 20000,                 // WebSocket 连接超时（毫秒）
  "ws_ping_interval": 30,           // WS ping 间隔（秒，0 为关闭）
  "ws_app_keepalive_interval": 25,  // 数据帧 keepalive 间隔（秒，0 为关闭）
  "remote": {
    "host": "example.com",
    "port": 443,
    "uuid": "00000000-0000-4000-8000-000000000000",
    "packet_encoding": "xudp"
  },
  "tls": {
    "enabled": true,
    "server_name": "example.com",
    "insecure": false
  },
  "transport": {
    "type": "ws",
    "path": "/your-websocket-path",
    "host": "example.com"
  }
}
```

所有配置项均可用环境变量覆盖（`REMOTE_HOST`、`REMOTE_PORT`、`UUID`、
`WS_PATH`、`WS_HOST`、`TLS`、`TLS_SERVER_NAME`、`TLS_INSECURE`、
`LOCAL_PORT`、`TIMEOUT`、`LOG_LEVEL`、`WS_PING_INTERVAL`、
`WS_APP_KEEPALIVE_INTERVAL`）。

### 使用

```bash
bun run client
# 指定配置文件
bun run client/bun-vlessclient.ts -c /path/to/config.json
# 帮助 / 版本
bun run client/bun-vlessclient.ts --help
bun run client/bun-vlessclient.ts --version
```

然后把浏览器或应用的代理指向 `socks5://127.0.0.1:1080`（或配置的端口）。

### 编译为独立可执行文件（可选）

```bash
bun build client/bun-vlessclient.ts --compile --outfile bvc
./bvc -c config.json
```

## 项目结构

```
bun-ws/
├── server/index.ts              # VLESS WebSocket 代理服务器
├── client/
│   ├── bun-vlessclient.ts       # VLESS 客户端 + 本地 SOCKS/HTTP 代理
│   ├── config.example.json      # 可提交的配置模板
│   └── config.json              # 本地配置（已 gitignore）
├── scripts/                     # 本地集成测试
├── Dockerfile / docker-compose.yml
├── bun-ws.service               # systemd 服务示例
└── package.json
```

## 常用命令

```bash
bun run start   # 启动代理服务器
bun run dev     # 热重载启动
bun run client  # 启动 VLESS 客户端
bun run build   # 打包服务器到 ./dist
bun test        # 运行测试
bun run lint    # Biome 代码检查
```

集成测试脚本：

```bash
bun run test:echo       # VLESS echo 往返
bun run test:keepalive  # 应用层 keepalive
bun run test:http       # HTTP 代理大 POST（回归测试）
bun run test:transfer   # 256 MiB 传输完整性测试
```

### HTTP 代理说明

一个本地 HTTP 代理连接只对应一条 VLESS 隧道。对于普通 HTTP 请求，客户端会把请求
改写为 origin-form、移除 `Proxy-Connection`、强制 `Connection: close`，并在源站
完成响应后关闭本地连接；客户端（包括 git/curl）会为下一个请求重新建立连接。这样
既能避免 keep-alive 请求被转发到错误的目标，也能避免在 WebSocket 握手期间到达的
请求体被误判为新的 HTTP 请求。

## Docker

```bash
docker build -t bun-ws .
docker run -d --name bun-ws -p 8333:8333 --env-file .env bun-ws
```

也可以直接使用 `docker-compose up -d` 运行已发布的镜像。

## systemd

参考 `bun-ws.service`，按实际情况修改 `WorkingDirectory`、`EnvironmentFile`
和 Bun 的可执行文件路径，然后安装到 `/etc/systemd/system/`：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bun-ws
```

## 安全建议

- 对外暴露服务器前务必更换默认 UUID。
- `.env` 与 `client/config.json` 包含敏感信息，已被 gitignore，请勿提交。
- 只开放必要端口；需要时通过反向代理终止 TLS。

## 许可证

Apache License 2.0 — 详见 [LICENSE](LICENSE)。
