import { serve } from "bun";

/**
 * bun-ws — VLESS-over-WebSocket proxy server.
 *
 * Supports TCP (CONNECT) VLESS requests only. Subscription endpoints, Trojan
 * and static file serving were intentionally removed.
 */

// --- Configuration -----------------------------------------------------------

const UUID = process.env.UUID || "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const WSPATH = process.env.WSPATH || UUID.slice(0, 8);
const PORT = Number.parseInt(process.env.PORT ?? "8333", 10);

/** UUID as 16 raw bytes (VLESS sends it uncompressed). */
const UUID_BYTES = (() => {
	const hex = UUID.replace(/-/g, "");
	if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
		throw new Error(`Invalid UUID: ${UUID}`);
	}
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
})();

// --- Backpressure thresholds -------------------------------------------------
// Bun's WebSocket server cannot pause inbound frames, so data that the TCP
// peer is not ready to accept must be buffered here. The limits are an OOM
// safety valve, not a normal event: git large transfers can stall for hundreds
// of milliseconds while the peer's TCP window recovers.
/** Pause TCP reads when the WebSocket send buffer exceeds this. */
const WS_HIGH_WATER = 1024 * 1024; // 1 MiB
/** Resume TCP reads when the WebSocket send buffer drops below this. */
const WS_LOW_WATER = 256 * 1024; // 256 KiB
/** Max bytes queued waiting for the TCP socket to drain (WS -> TCP). */
const TCP_WRITE_QUEUE_MAX = 64 * 1024 * 1024; // 64 MiB

// --- Types -------------------------------------------------------------------

interface WsData {
	socket: any | null;
	/** True while TCP reads are paused because the WS send buffer is full. */
	tcpPaused: boolean;
	/** True while WS -> TCP writes are blocked by TCP backpressure. */
	wsPaused: boolean;
	/** True while the client asked us to stop reading from the origin. */
	flowPaused: boolean;
	/** Buffered chunks waiting for the TCP socket to drain. */
	tcpWriteQueue: Uint8Array[];
	tcpWriteQueuedBytes: number;
	/** True once the VLESS handshake succeeded. */
	established: boolean;
}

function newWsData(): WsData {
	return {
		socket: null,
		tcpPaused: false,
		wsPaused: false,
		flowPaused: false,
		tcpWriteQueue: [],
		tcpWriteQueuedBytes: 0,
		established: false,
	};
}

// --- Helpers -----------------------------------------------------------------

async function resolveHost(host: string): Promise<string> {
	try {
		const result = await Bun.dns.lookup(host, {
			family: 4,
			signal: AbortSignal.timeout(3000),
		});
		return result[0].address;
	} catch {
		const result = await Bun.dns.lookup(host, {
			family: 6,
			signal: AbortSignal.timeout(3000),
		});
		return result[0].address;
	}
}

/**
 * Queue a chunk waiting for the TCP socket to be ready.
 */
function queueTcpWrite(ws: any, data: Uint8Array): void {
	const wsd = ws.data as WsData;
	wsd.tcpWriteQueue.push(data);
	wsd.tcpWriteQueuedBytes += data.length;
	if (wsd.tcpWriteQueuedBytes > TCP_WRITE_QUEUE_MAX) {
		console.error(
			`TCP write queue overflow (${wsd.tcpWriteQueuedBytes} bytes), closing connection`,
		);
		try {
			ws.close();
		} catch {}
	}
}

/**
 * Write data to the TCP socket, buffering when the kernel buffer is full.
 */
function writeToTcp(ws: any, socket: any, data: Uint8Array): void {
	if (data.length === 0) return;

	const wsd = ws.data as WsData;

	if (!socket || wsd.wsPaused) {
		queueTcpWrite(ws, data);
		return;
	}

	let written: number;
	try {
		written = socket.write(data);
	} catch {
		try {
			ws.close();
		} catch {}
		return;
	}

	// Bun returns the number of bytes written. -1 means the socket is closed.
	if (written === data.length) return;

	if (written === -1) {
		try {
			ws.close();
		} catch {}
		return;
	}

	if (written === 0) {
		queueTcpWrite(ws, data);
		wsd.wsPaused = true;
		return;
	}

	if (written > 0 && written < data.length) {
		queueTcpWrite(ws, data.subarray(written));
		wsd.wsPaused = true;
	}
}

/**
 * Flush WS -> TCP data after the TCP socket emits `drain`.
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
			try {
				ws.close();
			} catch {}
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

	if (wsd.wsPaused) {
		wsd.wsPaused = false;
	}
}

/**
 * Forward TCP data to the WebSocket and pause TCP reads when the WS send
 * buffer is full.
 */
function forwardTcpToWs(ws: any, socket: any, data: Uint8Array): void {
	const wsd = ws.data as WsData;

	try {
		ws.send(data);
	} catch {
		try {
			socket.end();
		} catch {}
		try {
			ws.close();
		} catch {}
		return;
	}

	if (ws.getBufferedAmount() > WS_HIGH_WATER && !wsd.tcpPaused) {
		wsd.tcpPaused = true;
		try {
			socket.pause();
		} catch {}
	}
}

/**
 * Connect to the requested origin and pump bytes in both directions.
 */
async function establishTcpConnection(
	ws: any,
	host: string,
	port: number,
	payload: Uint8Array,
): Promise<void> {
	try {
		const ip = await resolveHost(host);
		await Bun.connect({
			hostname: ip,
			port,
			socket: {
				open: (socket: any) => {
					ws.data.socket = socket;

					if (payload.length > 0) {
						writeToTcp(ws, socket, payload);
					}
					// Early data that arrived while the connect was in progress.
					flushTcpQueue(ws, socket);

					// The client may already be backed up (e.g. it asked us to
					// pause before the TCP connect finished).
					if ((ws.data as WsData).flowPaused) {
						try {
							socket.pause();
						} catch {}
					}
				},
				data: (socket: any, data: Uint8Array) => {
					forwardTcpToWs(ws, socket, data);
				},
				drain: (socket: any) => {
					flushTcpQueue(ws, socket);
				},
				close: () => {
					try {
						ws.close();
					} catch {}
				},
				end: () => {
					try {
						ws.close();
					} catch {}
				},
				error: (_socket: any, error: any) => {
					console.error("TCP socket error:", error?.message || error);
					try {
						ws.close();
					} catch {}
				},
			},
		});
	} catch (error: any) {
		console.error("TCP connection failed:", error?.message || error);
		try {
			ws.close();
		} catch {}
	}
}

// --- VLESS -------------------------------------------------------------------

/**
 * Parse a VLESS address.
 * VLESS address types: 1 = IPv4, 2 = domain, 3 = IPv6.
 */
function parseAddress(
	atyp: number,
	buffer: Uint8Array,
	offset: number,
): { host: string; offset: number } | false {
	let host: string;

	if (atyp === 1) {
		if (offset + 4 > buffer.length) return false;
		host = `${buffer[offset]}.${buffer[offset + 1]}.${buffer[offset + 2]}.${buffer[offset + 3]}`;
		offset += 4;
	} else if (atyp === 2) {
		if (offset >= buffer.length) return false;
		const hostLen = buffer[offset++];
		if (offset + hostLen > buffer.length) return false;
		host = new TextDecoder().decode(buffer.subarray(offset, offset + hostLen));
		offset += hostLen;
	} else if (atyp === 3) {
		if (offset + 16 > buffer.length) return false;
		const parts: string[] = [];
		for (let i = 0; i < 16; i += 2) {
			parts.push(((buffer[offset + i] << 8) | buffer[offset + i + 1]).toString(16));
		}
		host = parts.join(":");
		offset += 16;
	} else {
		return false;
	}

	return { host, offset };
}

/**
 * Handle the first WebSocket message as a VLESS request.
 * Only command 1 (TCP) is supported.
 */
function handleVless(ws: any, msg: Uint8Array): boolean {
	// 1 byte version + 16 bytes UUID + 1 byte addons length.
	if (msg.length < 18 || msg[0] !== 0) return false;

	for (let i = 0; i < 16; i++) {
		if (msg[1 + i] !== UUID_BYTES[i]) return false;
	}

	let pos = 17;
	const optLength = msg[pos++];
	if (pos + optLength + 4 > msg.length) return false;
	pos += optLength; // skip addons

	const command = msg[pos++];
	if (command !== 1) return false; // UDP is not supported

	const port = (msg[pos++] << 8) | msg[pos++];
	const atyp = msg[pos++];

	const target = parseAddress(atyp, msg, pos);
	if (!target) return false;

	const payload = msg.subarray(target.offset);

	// VLESS response: version + status 0.
	try {
		ws.send(new Uint8Array([0, 0]));
	} catch {
		return false;
	}

	// Mark established before the async connect so early data is queued
	// instead of being parsed as another VLESS request.
	(ws.data as WsData).established = true;

	void establishTcpConnection(ws, target.host, port, payload);
	return true;
}

// --- Server ------------------------------------------------------------------

console.log(`Server running on port ${PORT} (VLESS, path /${WSPATH})`);

serve({
	port: PORT,
	reusePort: true,
	development: false,

	async fetch(req, server) {
		try {
			const url = new URL(req.url);

			if (url.pathname === "/health") {
				return new Response("ok", {
					status: 200,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}

			if (url.pathname === `/${WSPATH}`) {
				const upgraded = server.upgrade(req, { data: newWsData() });
				return upgraded
					? undefined
					: new Response("WebSocket upgrade failed", { status: 400 });
			}

			return new Response("404 Not Found", {
				status: 404,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		} catch (error: any) {
			console.error(`Request handling error: ${error.message}`);
			return new Response("Internal Server Error", {
				status: 500,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
	},

	websocket: {
		// Large transfers buffer a lot in the send queue (TLS records from the
		// origin); never close mid-transfer because a client is briefly slow.
		// idleTimeout=0: the proxy manages its own lifecycle via ws.close() when
		// the origin closes; don't let Bun's 120s default self-close kick in.
		maxPayloadLength: 64 * 1024 * 1024,
		backpressureLimit: 64 * 1024 * 1024,
		closeOnBackpressureLimit: false,
		idleTimeout: 0,

		open(ws) {
			if (!ws.data) {
				ws.data = newWsData();
			}
		},

		message(ws, msg) {
			const wsd = ws.data as WsData;

			// Application-layer keepalive. Cloudflare's WebSocket proxy only
			// resets its 100s idle timer on data frames, so the client sends a
			// small text frame during stalls. Answer it and never forward it.
			// All real proxied traffic is binary; unknown text frames close.
			if (typeof msg === "string") {
				try {
					const obj = JSON.parse(msg);
					if (obj?.type === "keepalive") {
						ws.send(JSON.stringify({ type: "keepalive", pong: true }));
						return;
					}
					// End-to-end flow control: the client asks us to stop reading
					// from the origin when its local write queue is backed up,
					// because a WebSocket has no receive window of its own.
					if (obj?.type === "flow") {
						const paused = obj.paused === true;
						if (wsd.flowPaused !== paused) {
							wsd.flowPaused = paused;
							if (wsd.socket) {
								try {
									paused ? wsd.socket.pause() : wsd.socket.resume();
								} catch {}
							}
						}
						return;
					}
				} catch {}
				ws.close();
				return;
			}

			const data = msg instanceof Uint8Array ? msg : new Uint8Array(msg);

			if (wsd.established) {
				if (wsd.socket) {
					writeToTcp(ws, wsd.socket, data);
				} else {
					// TCP connect still in progress.
					queueTcpWrite(ws, data);
				}
				return;
			}

			if (!handleVless(ws, data)) {
				ws.close();
			}
		},

		drain(ws) {
			const wsd = ws.data as WsData;
			if (wsd.tcpPaused && ws.getBufferedAmount() < WS_LOW_WATER) {
				wsd.tcpPaused = false;
				try {
					wsd.socket?.resume();
				} catch {}
			}
		},

		close(ws) {
			const wsd = ws.data as WsData;
			if (wsd?.socket) {
				try {
					wsd.socket.end();
				} catch {}
			}
		},
	},
});
