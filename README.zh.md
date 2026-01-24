# bun-ws 🌐

**基于 Bun 运行时的超高性能 WebSocket 代理服务器**

一个轻量级、高性能的 WebSocket 代理服务器，支持 VLESS 和 Trojan 协议，具有企业级安全保护和优雅的深色主题界面。

## ✨ 功能特性

- **🚀 双协议支持**: VLESS 和 Trojan 双协议无缝切换
- **⚡ 超高性能**: 基于 Bun 运行时，提供卓越的性能表现
- **🎨 深色主题界面**: 现代设计，护眼舒适
- **🌍 智能 ISP 检测**: 自动优化网络连接
- **🔒 企业级安全**: TLS 加密传输，身份验证保护
- **📱 响应式设计**: 完美适配桌面和移动设备

## 🛠️ 快速开始

### 环境要求
- [Bun](https://bun.sh) 运行时 (版本 1.0.0 或更高)

### 安装步骤

```bash
# 安装 Bun (如果尚未安装)
curl -fsSL https://bun.sh/install | bash

# 克隆项目
git clone https://github.com/yixunbfb/bun-ws.git
cd bun-ws

# 启动服务器
bun run index.js
```

### 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8333` | 服务器端口 |
| `UUID` | `8ea48d91-eab2-4dfa-9169-859b0d43b3dc` | 身份验证 UUID |
| `DOMAIN` | `ws.bun-ws.com` | 您的域名 |
| `WSPATH` | UUID 前8位字符 | WebSocket 路径 |
| `SUB_PATH` | UUID 第9-13位字符 | 订阅路径 |
| `NAME` | `bun-ws` | 服务器显示名称 |

## 📖 使用说明

1. **启动服务器**:
   ```bash
   bun run index.js
   ```

2. **访问 Web 界面**:
   在浏览器中打开 `http://localhost:8333`

3. **获取订阅链接**:
   访问 `http://localhost:8333/您的订阅路径` 获取 Base64 编码的订阅链接

## 🔧 配置说明

服务器会自动检测您的 ISP 并生成相应的订阅链接。在生产环境中，请通过环境变量配置您的域名和路径。

### 自定义配置示例

```bash
# 设置自定义端口
export PORT=8080

# 设置自定义 UUID
export UUID="your-custom-uuid-here"

# 设置自定义域名
export DOMAIN="your-domain.com"

# 设置自定义路径
export WSPATH="custom-path"
export SUB_PATH="custom-sub"

# 设置服务器名称
export NAME="my-server"

# 启动服务器
bun run index.js
```

## 🚀 部署指南

### GitHub Pages (仅 Web 界面)
Web 界面会在每次推送到 main 分支时自动部署到 GitHub Pages。

### 自托管服务器部署
将完整服务器部署到您的基础设施：

```bash
# 生产环境部署
export NODE_ENV=production
export DOMAIN="your-domain.com"
bun run index.js
```

### Docker 部署 (推荐)

项目提供了基于 `oven/bun:alpine` 的轻量级 Docker 镜像：

```dockerfile
# 构建镜像
docker build -t bun-ws .

# 运行容器
docker run -d \
  --name bun-ws \
  -p 8333:8333 \
  -e DOMAIN="your-domain.com" \
  -e UUID="your-custom-uuid" \
  -e WSPATH="custom-ws-path" \
  -e SUB_PATH="custom-sub-path" \
  --restart unless-stopped \
  bun-ws
```

#### 使用 Docker Hub 镜像

```bash
# 拉取最新镜像
docker pull yixunbfb/bun-ws:latest

# 运行容器
docker run -d \
  --name bun-ws \
  -p 8333:8333 \
  -e DOMAIN="your-domain.com" \
  --restart unless-stopped \
  yixunbfb/bun-ws:latest
```

#### 使用 GitHub Container Registry

```bash
# 拉取镜像
docker pull ghcr.io/yixunbfb/bun-ws:latest

# 运行容器
docker run -d \
  --name bun-ws \
  -p 8333:8333 \
  -e DOMAIN="your-domain.com" \
  ghcr.io/yixunbfb/bun-ws:latest
```

#### Docker Compose 部署

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  bun-ws:
    image: yixunbfb/bun-ws:latest
    container_name: bun-ws
    ports:
      - "8333:8333"
    environment:
      - PORT=8333
      - DOMAIN=your-domain.com
      - UUID=your-custom-uuid
      - WSPATH=custom-ws-path
      - SUB_PATH=custom-sub-path
      - NAME=bun-ws-server
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8333/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
```

启动服务：
```bash
docker-compose up -d
docker-compose logs -f bun-ws
```

#### ARM64 设备部署 (如树莓派)

```bash
# 拉取 ARM64 镜像
docker pull ghcr.io/yixunbfb/bun-ws:latest-arm64

# 或从源码构建
docker build -t bun-ws:arm64 --platform linux/arm64 .
```

### Systemd 服务 (Linux)

创建 `/etc/systemd/system/bun-ws.service`：

```ini
[Unit]
Description=Bun WebSocket 代理服务器
After=network.target

[Service]
Type=simple
User=bun-ws
WorkingDirectory=/opt/bun-ws
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/bun run index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

启用并启动服务：
```bash
sudo systemctl enable bun-ws
sudo systemctl start bun-ws
```

## 📁 项目结构

```
bun-ws/
├── index.js              # 主服务器应用程序
├── public/               # 静态 Web 资源
│   └── index.html        # Web 界面 (深色主题)
├── .github/workflows/    # GitHub Actions 自动化
│   └── deploy.yml        # CI/CD 工作流
├── package.json          # 项目元数据和脚本
├── README.md             # 英文文档
└── README.zh.md          # 中文文档
```

## 🤝 贡献指南

欢迎贡献！请随时提交问题、功能请求或拉取请求。

### 贡献步骤

1. Fork 本项目
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建拉取请求

## 📄 许可证

Apache License 2.0 - 请参阅 [LICENSE](LICENSE) 文件获取详情。

## 🔗 相关链接

- **网站**: [GitHub Pages](https://yixunbfb.github.io/bun-ws)
- **仓库**: [GitHub](https://github.com/yixunbfb/bun-ws)
- **Bun 运行时**: [bun.sh](https://bun.sh)
- **问题反馈**: [Issues](https://github.com/yixunbfb/bun-ws/issues)
- **讨论社区**: [Discussions](https://github.com/yixunbfb/bun-ws/discussions)

## 📚 API 参考

### 端点说明

服务器提供以下端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 深色主题 Web 界面 |
| `/${SUB_PATH}` | GET | 订阅端点 (Base64 编码) |
| `/${WSPATH}` | WS | WebSocket 代理端点 |

### 订阅格式

订阅链接返回 Base64 编码的配置信息，包含：

- **VLESS 协议配置**: 轻量级代理协议
- **Trojan 协议配置**: TLS 安全代理协议

客户端会自动识别支持的协议。

## 🛡️ 安全建议

1. **UUID 安全**: 生产环境中请更改默认 UUID
2. **域名配置**: 使用您自己的域名而非默认值
3. **防火墙设置**: 仅暴露必要的端口
4. **定期更新**: 保持 Bun 运行时为最新版本

## 🔧 故障排除

### 端口被占用
```bash
# 查找占用端口的进程
lsof -i :8333

# 终止进程
kill -9 <进程ID>
```

### WebSocket 连接问题
- 确保配置了正确的 WebSocket 路径
- 如果从不同域名访问，检查 CORS 设置
- 验证 TLS 证书的有效性

### 性能问题
- 监控内存使用: `bun --inspect index.js`
- 检查网络带宽
- 考虑使用 nginx 等反向代理

## 📊 监控和维护

### 日志监控

服务器输出到 stdout/stderr，可以使用以下方式监控：

```bash
# 查看实时日志
tail -f /var/log/bun-ws.log

# 健康检查
curl -f http://localhost:8333/ || echo "服务器已关闭"
```

### 性能优化建议

1. **内存优化**: 监控内存使用情况，及时调整配置
2. **网络优化**: 根据 ISP 检测结果选择最优线路
3. **并发优化**: 调整 Bun 的并发设置以适应高负载

## 🙏 致谢

- [Bun](https://bun.sh) - 超快的 JavaScript 运行时
- [V2Ray](https://www.v2ray.com/) - 强大的代理协议
- [GitHub Actions](https://github.com/features/actions) - CI/CD 自动化

## 📈 统计信息

![GitHub stars](https://img.shields.io/github/stars/yixunbfb/bun-ws)
![GitHub forks](https://img.shields.io/github/forks/yixunbfb/bun-ws)
![GitHub issues](https://img.shields.io/github/issues/yixunbfb/bun-ws)
![License](https://img.shields.io/github/license/yixunbfb/bun-ws)

---

用 ❤️ 由 Bun 制作 | Apache License 2.0
