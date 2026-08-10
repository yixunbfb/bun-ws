import { serve } from "bun";

const UUID = process.env.UUID || "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const DOMAIN = process.env.DOMAIN || "ws.bun-ws.com";
const WSPATH = process.env.WSPATH || UUID.slice(0, 8);
const SUB_PATH = process.env.SUB_PATH || UUID.slice(9, 13);
const NAME = process.env.NAME || "bun-ws";
const PORT = process.env.PORT || 8333;

const STATIC_DIR = `${import.meta.dir}/public`;

const uuid = UUID.replace(/-/g, "");

// --- Backpressure thresholds ---
// NOTE: Bun's WebSocket server cannot pause *inbound* frames (no ws.pause(),
// and async message handlers run concurrently), so client->server data that the
// TCP peer cannot yet accept MUST be buffered here. The buffer must comfortably
// exceed the bandwidth-delay product of real paths (git large transfers stall
// for hundreds of ms while github's TCP window recovers), so the overflow close
// below is only an OOM safety valve for runaway clients — not a normal event.
/** Pause TCP reads when WebSocket send buffer exceeds this. */
const WS_HIGH_WATER = 1024 * 1024; // 1 MiB
/** Resume TCP reads when WebSocket send buffer drops below this. */
const WS_LOW_WATER = 256 * 1024; // 256 KiB
/** Max bytes queued waiting for TCP socket drain (WS→TCP). */
const TCP_WRITE_QUEUE_MAX = 64 * 1024 * 1024; // 64 MiB

interface WsData {
	socket: any | null;
	/** True while TCP socket is paused due to WS backpressure. */
	tcpPaused: boolean;
	/** True while WS→TCP writes are blocked (TCP kernel buffer full). */
	wsPaused: boolean;
	/** Buffered chunks waiting for TCP drain. */
	tcpWriteQueue: Uint8Array[];
	tcpWriteQueuedBytes: number;
	/** Protocol established (VLESS or Trojan) — prevents race condition. */
	established: boolean;
}

function newWsData(): WsData {
	return {
		socket: null,
		tcpPaused: false,
		wsPaused: false,
		tcpWriteQueue: [],
		tcpWriteQueuedBytes: 0,
		established: false,
	};
}

async function resolveHost(host: string): Promise<string> {
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
		} catch (error: any) {
			throw new Error(`Failed to resolve ${host}: ${error.message}`);
		}
	}
}

/**
 * Write data to the TCP socket with backpressure.
 * If the kernel buffer is full, queue data and pause WS receiving.
 */
function writeToTcp(ws: any, socket: any, data: Uint8Array): void {
	const wsd = ws.data as WsData;
	if (!socket || wsd.wsPaused) {
		// Queue data while TCP is backed up
		wsd.tcpWriteQueue.push(data);
		wsd.tcpWriteQueuedBytes += data.length;
		if (wsd.tcpWriteQueuedBytes > TCP_WRITE_QUEUE_MAX) {
			console.error("TCP write queue overflow, closing connection");
			try { ws.close(); } catch {}
		}
		return;
	}

	let written: number;
	try {
		written = socket.write(data);
	} catch {
		try { ws.close(); } catch {}
		return;
	}

	// Bun: full write returns byte length; -1 means socket closed
	if (written === data.length) return;

	if (written === -1) {
		// TCP peer is gone — close the tunnel instead of queueing forever
		try { ws.close(); } catch {}
		return;
	}

	if (written === 0) {
		wsd.tcpWriteQueue.push(data);
		wsd.tcpWriteQueuedBytes += data.length;
		wsd.wsPaused = true;
		return;
	}

	// Partial write — queue remainder
	if (written > 0 && written < data.length) {
		wsd.tcpWriteQueue.push(data.subarray(written));
		wsd.tcpWriteQueuedBytes += data.length - written;
		wsd.wsPaused = true;
	}
}

/**
 * Flush queued data to the TCP socket after drain.
 */
function flushTcpQueue(ws: any, socket: any): void {
	const wsd = ws.data as WsData;
	if (!socket) return;

	while (wsd.tcpWriteQueue.length > 0) {
		const chunk = wsd.tcpWriteQueue[0];
		let written: number;
		try {
			written = socket.write(chunk);
		} catch {
			try { ws.close(); } catch {}
			return;
		}

		if (written === -1 || written === 0 || written === undefined) return;

		if (written < chunk.length) {
			wsd.tcpWriteQueue[0] = chunk.subarray(written);
			wsd.tcpWriteQueuedBytes -= written;
			return;
		}

		wsd.tcpWriteQueue.shift();
		wsd.tcpWriteQueuedBytes -= chunk.length;
	}

	// Queue empty — resume WS receiving
	if (wsd.wsPaused) {
		wsd.wsPaused = false;
	}
}

/**
 * Forward data from TCP socket to WebSocket with backpressure.
 * Pauses the TCP socket when WebSocket buffer is full.
 */
function forwardTcpToWs(ws: any, socket: any, data: Uint8Array): void {
	const wsd = ws.data as WsData;
	try {
		ws.send(data);
	} catch {
		try { socket.end(); } catch {}
		try { ws.close(); } catch {}
		return;
	}

	// Check WebSocket backpressure
	const buffered = ws.getBufferedAmount();
	if (buffered > WS_HIGH_WATER && !wsd.tcpPaused) {
		wsd.tcpPaused = true;
		try { socket.pause(); } catch {}
	}
}

/**
 * Establish TCP connection and set up data forwarding with backpressure.
 */
async function establishTcpConnection(ws: any, host: string, port: number, payload: Uint8Array) {
	try {
		const ip = await resolveHost(host);
		await Bun.connect({
			hostname: ip,
			port: port,
			socket: {
				open: (socket: any) => {
					// Save socket instance to ws.data
					ws.data.socket = socket;

					// After connection is established, send any pending payload
					if (payload.length > 0) {
						writeToTcp(ws, socket, payload);
					}

					// Flush any early-data messages that were queued while
					// TCP connect was in progress (race condition fix)
					flushTcpQueue(ws, socket);
				},
				data: (_socket: any, data: Uint8Array) => {
					// Forward data from TCP to WebSocket (with backpressure)
					forwardTcpToWs(ws, _socket, data);
				},
				close: () => {
					try { ws.close(); } catch {}
				},
				error: (_socket: any, error: any) => {
					console.error("TCP socket error:", error?.message || error);
					try { ws.close(); } catch {}
				},
				drain: (socket: any) => {
					// TCP kernel buffer has space — flush queued WS→TCP data
					flushTcpQueue(ws, socket);
				},
				end: (_socket: any) => {
					try { ws.close(); } catch {}
				},
			},
		});
	} catch (error: any) {
		console.error("TCP connection failed:", error?.message || error);
		try { ws.close(); } catch {}
	}
}

// Parse address from packet
// vless atyp=1,2,3 Trojan atyp=1,3,4
function parseAddress(atyp: number, buffer: Buffer, offset: number): { host: string; offset: number } | false {
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
				(s: Buffer[], _b: number, i: number, a: Buffer) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s),
				[],
			)
			.map((b: Buffer) => b.readUInt16BE(0).toString(16))
			.join(":");
		offset += 16;
	} else {
		return false;
	}

	return { host: host, offset: offset };
}

/**
 * VLESS Handler
 * Returns true if the message was handled as VLESS.
 */
function handleVlessConnection(ws: any, msg: Buffer): boolean {
	try {
		if (msg.length <= 17 || msg[0] !== 0) return false;

		// Validate UUID
		const id = msg.slice(1, 17);
		if (!id.every((v: number, i: number) => v === parseInt(uuid.slice(i * 2, i * 2 + 2), 16)))
			return false;

		// Parse Metadata
		let pos = 17;
		const optLength = msg[pos++];
		pos += optLength; // Skip options

		const _command = msg[pos++]; // 1=TCP, 2=UDP
		const port = (msg[pos++] << 8) | msg[pos++];
		const atyp = msg[pos++];

		const result = parseAddress(atyp, msg, pos);
		if (!result) return false;
		pos = result.offset;

		// Acknowledge connection
		ws.send(new Uint8Array([msg[0], 0]));

		// 4. Get remaining payload from the first packet
		const payload = msg.subarray(pos);

		// 5. Mark as established BEFORE async TCP connect to avoid race condition
		//    This prevents early-data messages from being misinterpreted as new protocol headers
		ws.data.established = true;

		// 6. Establish TCP connection and set up forwarding
		establishTcpConnection(ws, result.host, port, payload);

		return true;
	} catch (_e) {
		return false;
	}
}

/**
 * Trojan Handler
 * Returns true if the message was handled as Trojan.
 */
async function handleTrojanConnection(ws: any, msg: Buffer): Promise<boolean> {
	try {
		if (msg.length < 58) return false;

		// Validate Password (SHA224 of UUID)
		const receivedHash = new TextDecoder().decode(msg.slice(0, 56));
		const targetHashBuffer = await crypto.subtle.digest(
			"SHA-224",
			new TextEncoder().encode(UUID),
		);
		const targetHash = Array.from(new Uint8Array(targetHashBuffer))
			.map((b: number) => b.toString(16).padStart(2, "0"))
			.join("");

		if (receivedHash.toLowerCase() !== targetHash.toLowerCase()) return false;

		let pos = 56;
		if (msg[pos] === 0x0d && msg[pos + 1] === 0x0a) pos += 2; // CRLF

		const cmd = msg[pos++];
		if (cmd !== 1) return false; // Only CONNECT supported

		const atyp = msg[pos++];

		const addType: Record<number, number> = { 1: 1, 3: 2, 4: 3 }; // Ip address type map

		const result = parseAddress(addType[atyp], msg, pos);
		if (!result) return false;
		pos = result.offset;

		const port = (msg[pos++] << 8) | msg[pos++];

		// Skip trailing CRLF if present
		if (pos < msg.length && msg[pos] === 0x0d && msg[pos + 1] === 0x0a)
			pos += 2;

		const payload = msg.subarray(pos);

		// Mark as established BEFORE async TCP connect
		ws.data.established = true;

		// 3. Establish TCP connection and set up forwarding
		establishTcpConnection(ws, result.host, port, payload);

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

serve({
	port: PORT,
	reusePort: true,
	development: false,

	async fetch(req, server) {
		const url = new URL(req.url);

		try {
			// Subscription endpoint
			if (url.pathname === `/${SUB_PATH}`) {
				return new Response(getSub(), {
					status: 200,
					headers: {
						"Content-Type": "text/plain",
						"Cache-Control": "no-cache",
					},
				});
			}

			// 2. WebSocket Upgrade
			if (url.pathname === `/${WSPATH}`) {
				const success = server.upgrade(req, {
					data: newWsData(),
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
		} catch (error: any) {
			console.error(`Request handling error: ${error.message}`);
			return new Response("Internal Server Error", {
				status: 500,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
	},

	websocket: {
		// Note: Data is initialized during upgrade in fetch handler
		// Large transfers buffer a lot in the send queue (TLS records from the
		// origin); never close mid-transfer because a client is briefly slow.
		// idleTimeout=0: the proxy manages its own lifecycle via ws.close() on
		// origin close; don't let Bun's 120s default self-close kick in.
		maxPayloadLength: 64 * 1024 * 1024,
		backpressureLimit: 64 * 1024 * 1024,
		closeOnBackpressureLimit: false,
		idleTimeout: 0,
		open(ws) {
			// Fallback: Ensure data exists even if upgrade didn't pass it
			if (!ws.data) {
				ws.data = newWsData();
			}
		},
		async message(ws, msg) {
			const wsd = ws.data as WsData;

			// Application-layer keepalive (Cloudflare WS proxy only resets its
			// 100s idle timer on DATA frames — control-frame pings are ignored).
			// The client sends a small text frame on a timer during stalls; we
			// reply and never forward it, since all real proxied traffic is binary.
			// Unknown text frames close the connection.
			if (typeof msg === "string") {
				try {
					const obj = JSON.parse(msg);
					if (obj?.type === "keepalive") {
						ws.send(JSON.stringify({ type: "keepalive", pong: true }));
						return;
					}
				} catch {}
				ws.close();
				return;
			}

			// Case 1: Connection already established (or establishing) — forward data to TCP
			// Using `established` flag instead of `socket` check to avoid race condition:
			// TCP connect is async; early-data messages may arrive before socket is ready.
			if (wsd.established) {
				if (wsd.socket) {
					// Socket ready — write directly (with backpressure)
					writeToTcp(ws, wsd.socket, msg instanceof Buffer ? msg : Buffer.from(msg));
				} else {
					// TCP connect in progress — queue data, will be sent on open
					wsd.tcpWriteQueue.push(msg instanceof Buffer ? msg : Buffer.from(msg));
					wsd.tcpWriteQueuedBytes += msg.length;
				}
				return;
			}

			// Case 2: First message — try to parse as VLESS or Trojan protocol
			const buf = msg instanceof Buffer ? msg : Buffer.from(msg);

			if (handleVlessConnection(ws, buf)) return;
			if (await handleTrojanConnection(ws, buf)) return;

			// If neither protocol matched, close the connection.
			ws.close();
		},
		drain(ws) {
			// WebSocket send buffer has drained — resume TCP reads if paused
			const wsd = ws.data as WsData;
			const buffered = ws.getBufferedAmount();
			if (buffered < WS_LOW_WATER && wsd.tcpPaused) {
				wsd.tcpPaused = false;
				if (wsd.socket) {
					try { wsd.socket.resume(); } catch {}
				}
			}
		},
		close(ws, code, reason) {
			console.error(
				`[WS-CLOSE] code=${code} reason=${JSON.stringify(reason)} ok=${code === 1000} wsBuffered=${ws.getBufferedAmount()}`,
			);
			// When WebSocket closes, destroy the corresponding TCP socket
			const wsd = ws.data as WsData;
			if (wsd?.socket) {
				try { wsd.socket.end(); } catch {}
			}
		},
	},
});
