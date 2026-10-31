# bun-ws

Bun-native WebSocket proxy toolkit:

- **`server/`** — VLESS-over-WebSocket proxy server (the original project).
- **`client/`** — standalone VLESS client with a local SOCKS5 / SOCKS4 / HTTP proxy, configured by a JSON file.
- **`scripts/`** — local integration tests (keepalive, echo, HTTP proxy, large transfer).

## Requirements

- [Bun](https://bun.sh) 1.0.0 or newer
- No third-party runtime dependencies

## Quick start

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

git clone https://github.com/yixunbfb/bun-ws.git
cd bun-ws

# Run the server
bun run start          # bun run server/index.ts
bun run dev            # watch mode

# Run the client (uses client/config.json by default)
bun run client
```

## Server

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8333` | Listen port |
| `UUID` | `8ea48d91-eab2-4dfa-9169-859b0d43b3dc` | Authentication UUID (VLESS ID) |
| `WSPATH` | First 8 chars of `UUID` | WebSocket path |

Copy `.env.example` to `.env` and adjust the values.

### Endpoints

- `GET /health` — health check (`200 ok`)
- `WS /<WSPATH>` — VLESS-over-WebSocket proxy endpoint

Only VLESS TCP requests are supported. There is no subscription endpoint and no
Trojan support.

## Client

The client is a single Bun script: `client/bun-vlessclient.ts`. It accepts VLESS over
WebSocket and exposes a local SOCKS5 (with SOCKS4/SOCKS4a and HTTP proxy detection)
listener on `local_port`.

### Configuration file

`client/config.json` is loaded by default. Copy the example and edit it:

```bash
cp client/config.example.json client/config.json
```

```jsonc
{
  "log_level": "info",              // debug | info | warn | error | none
  "local_port": 1080,               // local SOCKS/HTTP proxy port
  "timeout": 20000,                 // WebSocket connect timeout (ms)
  "ws_ping_interval": 30,           // WS ping interval (s, 0 = off)
  "ws_app_keepalive_interval": 25,  // data-frame keepalive (s, 0 = off)
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

Every value can be overridden with environment variables (`REMOTE_HOST`,
`REMOTE_PORT`, `UUID`, `WS_PATH`, `WS_HOST`, `TLS`, `TLS_SERVER_NAME`,
`TLS_INSECURE`, `LOCAL_PORT`, `TIMEOUT`, `LOG_LEVEL`, `WS_PING_INTERVAL`,
`WS_APP_KEEPALIVE_INTERVAL`).

### Usage

```bash
bun run client
# custom config
bun run client/bun-vlessclient.ts -c /path/to/config.json
# help / version
bun run client/bun-vlessclient.ts --help
bun run client/bun-vlessclient.ts --version
```

Then point browsers/apps at `socks5://127.0.0.1:1080` (or the configured port).

### Standalone binary (optional)

```bash
bun build client/bun-vlessclient.ts --compile --outfile bvc
./bvc -c config.json
```

## Project structure

```
bun-ws/
├── server/index.ts              # VLESS WebSocket proxy server
├── client/
│   ├── bun-vlessclient.ts       # VLESS client + local SOCKS/HTTP proxy
│   ├── config.example.json      # committed template
│   └── config.json              # local config (gitignored)
├── scripts/                     # local integration tests
├── Dockerfile / docker-compose.yml
├── bun-ws.service               # systemd unit example
└── package.json
```

## Commands

```bash
bun run start   # start the proxy server
bun run dev     # start with hot reload
bun run client  # start the VLESS client
bun run build   # bundle the server into ./dist
bun test        # run tests
bun run lint    # Biome checks
```

Integration scripts:

```bash
bun run test:echo       # VLESS echo round-trip
bun run test:keepalive  # application-level keepalive
bun run test:http       # HTTP proxy large POST (regression test)
bun run test:flow       # end-to-end flow control with a slow consumer
bun run test:transfer   # 256 MiB transfer with integrity check
```

### HTTP proxy notes

A local HTTP proxy connection is mapped to exactly one VLESS tunnel. For plain
HTTP requests the client rewrites the request to origin-form, strips
`Proxy-Connection`, forces `Connection: close`, and closes the local connection
once the origin finishes the response. Clients (including git/curl) then
reconnect for the next request. This avoids routing keep-alive requests to the
wrong host and prevents request bodies that arrive during the WebSocket
handshake from being mis-parsed.

### Flow control

A WebSocket has no receive window, so a slow local consumer (git unpacking a
packfile, a browser writing to disk) cannot throttle the origin by itself. When
the client has more than 8 MiB waiting for the local socket, it sends a
`{"type":"flow","paused":true}` control frame; the server pauses reading from
the origin TCP socket until the client drops below 2 MiB and sends
`paused:false`. Without this, large transfers eventually hit the in-memory queue
cap and get disconnected.

## Docker

```bash
docker build -t bun-ws .
docker run -d --name bun-ws -p 8333:8333 --env-file .env bun-ws
```

Or use the published image via `docker-compose up -d`.

## systemd

See `bun-ws.service`. Adjust `WorkingDirectory`, `EnvironmentFile` and the Bun path,
then install it under `/etc/systemd/system/`:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bun-ws
```

## Security

- Change the default UUID before exposing the server.
- Keep `.env` and `client/config.json` private; both are gitignored.
- Only expose the ports you need and terminate TLS at a reverse proxy if required.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
