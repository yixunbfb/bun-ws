# bun-ws 🌐

**High-performance WebSocket proxy server based on Bun runtime**

A lightweight, high-performance WebSocket proxy server supporting VLESS and Trojan protocols with enterprise-grade security and an elegant dark theme interface.

## ✨ Features

- **🚀 Dual Protocol Support**: VLESS and Trojan protocols
- **⚡ High Performance**: Built on Bun runtime for exceptional speed
- **🎨 Dark Theme UI**: Modern, easy-on-the-eyes interface
- **🌍 Auto ISP Detection**: Intelligent network optimization
- **🔒 Enterprise Security**: TLS encryption and authentication
- **📱 Responsive Design**: Works on desktop and mobile devices

## 🛠️ Quick Start

### Prerequisites
- [Bun](https://bun.sh) runtime (version 1.0.0 or higher)

### Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone the repository
git clone https://github.com/yixunbfb/bun-ws.git
cd bun-ws

# Start the server
bun run index.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8333` | Server port |
| `UUID` | `8ea48d91-eab2-4dfa-9169-859b0d43b3dc` | Authentication UUID |
| `DOMAIN` | `ws.bun-ws.com` | Your domain name |
| `WSPATH` | First 8 chars of UUID | WebSocket path |
| `SUB_PATH` | Characters 9-13 of UUID | Subscription path |
| `NAME` | `bun-ws` | Server display name |

## 📖 Usage

1. **Start the server**:
   ```bash
   bun run index.js
   ```

2. **Access the web interface**:
   Open `http://localhost:8333` in your browser

3. **Get subscription links**:
   Visit `http://localhost:8333/YOUR_SUB_PATH` to get base64-encoded subscription links

## 🔧 Configuration

The server automatically detects your ISP and generates appropriate subscription links. Configure your domain and paths through environment variables for production use.

## 🚀 Deployment

### GitHub Pages (for web interface only)
The web interface is automatically deployed to GitHub Pages on each push to the main branch.

### Self-hosted Server
Deploy the full server to your own infrastructure:

```bash
# Production deployment
export NODE_ENV=production
export DOMAIN=your-domain.com
bun run index.js
```

## 📁 Project Structure

```
bun-ws/
├── index.js              # Main server application
├── public/               # Static web assets
│   └── index.html        # Web interface (dark theme)
├── .github/workflows/    # GitHub Actions automation
│   └── deploy.yml        # CI/CD workflow
├── package.json          # Project metadata and scripts
└── README.md            # This file
```

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues, feature requests, or pull requests.

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: [GitHub Pages](https://yixunbfb.github.io/bun-ws)
- **Repository**: [GitHub](https://github.com/yixunbfb/bun-ws)
- **Bun Runtime**: [bun.sh](https://bun.sh)

## 📚 Additional Documentation

### API Reference

The server provides the following endpoints:

- `GET /` - Web interface
- `GET /${SUB_PATH}` - Subscription endpoint (base64 encoded)
- `WS /${WSPATH}` - WebSocket proxy endpoint

### Configuration

All configuration is done through environment variables:

```bash
export PORT=8333
export UUID="your-custom-uuid"
export DOMAIN="your-domain.com"
export WSPATH="custom-ws-path"
export SUB_PATH="custom-sub-path"

bun run index.js
```

### Docker Deployment

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
EXPOSE 8333
CMD ["bun", "run", "index.js"]
```

### Systemd Service

Create `/etc/systemd/system/bun-ws.service`:

```ini
[Unit]
Description=Bun WebSocket Proxy Server
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

Enable and start:
```bash
sudo systemctl enable bun-ws
sudo systemctl start bun-ws
```

### Monitoring

The server logs to stdout/stderr. You can monitor it with:

```bash
# Check server status
tail -f /var/log/bun-ws.log

# Health check (if server is running)
curl -f http://localhost:8333/ || echo "Server down"
```

### Security Considerations

1. **UUID Security**: Change the default UUID in production
2. **Domain Configuration**: Use your own domain instead of the default
3. **Firewall**: Only expose necessary ports
4. **Regular Updates**: Keep Bun runtime updated

### Troubleshooting

**Port already in use:**
```bash
lsof -i :8333  # Find process using port 8333
kill -9 <PID>   # Kill the process
```

**WebSocket connection issues:**
- Ensure the correct WebSocket path is configured
- Check CORS settings if accessing from different domains
- Verify TLS certificates are valid

**Performance issues:**
- Monitor memory usage: `bun --inspect index.js`
- Check network bandwidth
- Consider using a reverse proxy like nginx


---

Made with ❤️ using Bun | Apache License 2.0
