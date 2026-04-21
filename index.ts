import { serve } from "bun";

const UUID = process.env.UUID || "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const DOMAIN = process.env.DOMAIN || "ws.bun-ws.com";
const WSPATH = process.env.WSPATH || UUID.slice(0, 8);
const SUB_PATH = process.env.SUB_PATH || UUID.slice(9, 13);
const NAME = process.env.NAME || "bun-ws";
const PORT = process.env.PORT || 8333;

const STATIC_DIR = `${import.meta.dir}/public`;

const uuid = UUID.replace(/-/g, "");

async function resolveHost(host) {
	// Try IPv4 first, then IPv6
	try {
		const result = await Bun.dns.lookup(host, {
			family: 4,
			signal: AbortSignal.timeout(3000),
		});
		return result[0].address;
	} catch {
		try {
			const result = await Bun.dns.lookup(host, {
				family: 6,
				signal: AbortSignal.timeout(3000),
			});
			return result[0].address;
		} catch (error) {
			throw new Error(`Failed to resolve ${host}: ${error.message}`);
		}
	}
}

/**
 * Establish TCP connection and set up data forwarding
 */
async function establishTcpConnection(ws, host, port, payload) {
	try {
		const ip = await resolveHost(host);
		const _remoteSocket = await Bun.connect({
			hostname: ip,
			port: port,
			socket: {
				open: (socket) => {
					// Save socket instance to ws.data
					ws.data.socket = socket;

					// After connection is established, send any pending payload
					if (payload.length > 0) socket.write(payload);
				},
				data: (_socket, data) => {
					// Forward data from TCP to WebSocket
					ws.send(data);
				},
				close: () => ws.close(),
				error: () => ws.close(),
				drain: () => {},
				end: () => ws.close(),
			},
		});
	} catch (error) {
		console.error("TCP connection failed:", error);
		ws.close();
	}
}

// Parse address from packet
// vless atyp=1,2,3 Trojan atyp=1,3,4
function parseAddress(atyp, buffer, offset) {
	let host: string;
	if (atyp === 1) {
		//IPv4
		host = buffer.slice(offset, offset + 4).join(".");
		offset += 4;
	} else if (atyp === 2) {
		//Domain
		const hostLen = buffer[offset];
		offset += 1;
		host = buffer.slice(offset, offset + hostLen).toString();
		offset += hostLen;
	} else if (atyp === 3) {
		//IPv6
		host = buffer
			.slice(offset, offset + 16)
			.reduce(
				(s, _b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s),
				[],
			)
			.map((b) => b.readUInt16BE(0).toString(16))
			.join(":");
		offset += 16;
	} else {
		return false;
	}

	return { host: host, offset: offset };
}

/**
 * VLESS Handler
 */
function handleVlessConnection(ws, msg) {
	try {
		if (msg.length <= 17 || msg[0] !== 0) return false;

		// Validate UUID
		const id = msg.slice(1, 17);
		if (!id.every((v, i) => v === parseInt(uuid.slice(i * 2, i * 2 + 2), 16)))
			return false;

		// Parse Metadata
		let pos = 17;
		const optLength = msg[pos++];
		pos += optLength; // Skip options

		const _command = msg[pos++]; // 1=TCP, 2=UDP
		const port = (msg[pos++] << 8) | msg[pos++];
		const atyp = msg[pos++];

		const { host, offset } = parseAddress(atyp, msg, pos);
		pos = offset;

		// Acknowledge connection
		ws.send(new Uint8Array([msg[0], 0]));

		// 4. Get remaining payload from the first packet
		const payload = msg.slice(pos);

		// 5. Establish TCP connection and set up forwarding
		establishTcpConnection(ws, host, port, payload);

		return true;
	} catch (_e) {
		return false;
	}
}

/**
 * Trojan Handler
 */
async function handleTrojanConnection(ws, msg) {
	try {
		if (msg.length < 58) return false;

		// Validate Password (SHA224 of UUID)
		const receivedHash = new TextDecoder().decode(msg.slice(0, 56));
		const targetHashBuffer = await crypto.subtle.digest(
			"SHA-224",
			new TextEncoder().encode(UUID),
		);
		const targetHash = Array.from(new Uint8Array(targetHashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		if (receivedHash.toLowerCase() !== targetHash.toLowerCase()) return false;

		let pos = 56;
		if (msg[pos] === 0x0d && msg[pos + 1] === 0x0a) pos += 2; // CRLF

		const cmd = msg[pos++];
		if (cmd !== 1) return false; // Only CONNECT supported

		const atyp = msg[pos++];

		const addType = { 1: 1, 3: 2, 4: 3 }; //Ip address type map

		const { host, offset } = parseAddress(addType[atyp], msg, pos);
		pos = offset;

		const port = (msg[pos++] << 8) | msg[pos++];

		// Skip trailing CRLF if present
		if (pos < msg.length && msg[pos] === 0x0d && msg[pos + 1] === 0x0a)
			pos += 2;

		const payload = msg.slice(pos);

		// 3. Establish TCP connection and set up forwarding
		establishTcpConnection(ws, host, port, payload);

		return true;
	} catch (_e) {
		return false;
	}
}

/**
 * Subscription Generator
 */
function getSub() {
	const commonParams = `security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2F${WSPATH}#${encodeURIComponent(NAME)}`;

	const vlessURL = `vless://${UUID}@${DOMAIN}:443?encryption=none&${commonParams}`;
	const trojanURL = `trojan://${UUID}@${DOMAIN}:443?${commonParams}`;

	return Buffer.from(`${vlessURL}\n${trojanURL}`).toString("base64");
}

/**
 * Server
 */
console.log(`Server running on port ${PORT}`);
// console.log(`UUID: ${UUID}`);
// console.log(`WS Path: /${WSPATH}`);

serve({
	port: PORT,
	reusePort: true,
	development: false,

	async fetch(req, server) {
		const url = new URL(req.url);

		try {
			// Subscription endpoint
			// console.log(`path: ${url.pathname}, sub_path: /${SUB_PATH}`);
			if (url.pathname === `/${SUB_PATH}`) {
				return new Response(getSub(), {
					status: 200,
					headers: {
						"Content-Type": "text/plain",
						"Cache-Control": "no-cache",
					},
				});
			}

			// console.log(`path: ${url.pathname}, wspath: /${WSPATH}`);
			// 2. WebSocket Upgrade
			if (url.pathname === `/${WSPATH}`) {
				const success = server.upgrade(req, {
					data: { socket: null }, // Initialize socket data
				});
				return success
					? undefined
					: new Response("WebSocket upgrade failed", { status: 400 });
			}

			// 3. Static File Serving with Bun native methods
			const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
			const fullPath = `${STATIC_DIR}${filePath}`;

			// Use Bun.file() for efficient static file serving with automatic MIME type detection
			const bunFile = Bun.file(fullPath);

			if (await bunFile.exists()) {
				return new Response(bunFile, {
					headers: {
						"Content-Type": bunFile.type || "text/plain; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
						"Access-Control-Allow-Origin": "*",
					},
				});
			}

			// Handle 404 for SPA routing or missing files
			if (filePath.includes(".") || filePath === "/") {
				return new Response("404 Not Found", {
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			// SPA fallback - serve index.html for client-side routing
			const indexFile = Bun.file(`${STATIC_DIR}/index.html`);
			if (await indexFile.exists()) {
				return new Response(indexFile, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			return new Response("404 Not Found", { status: 404 });
		} catch (error) {
			console.error(`Request handling error: ${error.message}`);
			return new Response("Internal Server Error", {
				status: 500,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
	},

	websocket: {
		// Note: Data is initialized during upgrade in fetch handler
		open(ws) {
			// Fallback: Ensure data exists even if upgrade didn't pass it
			if (!ws.data || typeof ws.data.socket === "undefined") {
				ws.data = { socket: null };
			}
		},
		async message(ws, msg) {
			// Case 1: Connection already established, forward directly
			if (ws.data.socket) {
				// Ensure socket is writable
				try {
					ws.data.socket.write(Buffer.from(msg));
				} catch (_e) {
					ws.close();
				}
				return;
			}

			// NOTE: We must check protocols sequentially.
			// If one succeeds, we return immediately.

			if (handleVlessConnection(ws, Buffer.from(msg))) return;
			if (await handleTrojanConnection(ws, Buffer.from(msg))) return;

			// If neither protocol matched, close the connection.
			ws.close();
		},
		close(ws) {
			// When WebSocket closes, destroy the corresponding TCP socket
			if (ws.data.socket) {
				ws.data.socket.end();
			}
		},
	},
});
