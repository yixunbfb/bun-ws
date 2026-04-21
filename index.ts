import { serve } from "bun";

import {
	authenticateUser,
	createSession,
	createUser,
	getSettingsByToken,
	getUserSettingsByUserId,
	saveSettingsByToken,
	validateSession,
} from "./db.ts";

// Environment Variables
const UUID = process.env.UUID || "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const DOMAIN = process.env.DOMAIN || "ws.bun-ws.com"; // your domain
const WSPATH = process.env.WSPATH || UUID.slice(0, 8);
const SUB_PATH = process.env.SUB_PATH || UUID.slice(9, 13);
const NAME = process.env.NAME || "bun-ws";
const PORT = process.env.PORT || 8333;

// AI Configuration
const AI_API_URL =
	process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "gpt-3.5-turbo";

// Clean UUID
const uuid = UUID.replace(/-/g, "");

const STATIC_DIR = `${import.meta.dir}/public`; // Ensure STATIC_DIR is defined

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
	let host;
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
			if (url.pathname === "/api/set-key" && req.method === "POST") {
				// todo: frontend post {api_base_url, api_key, api_model}, change them to .env url, key, model variables
			}

			// 0.3. AI Chat API endpoint (New)
			if (url.pathname === `/api/ai-chat` && req.method === "POST") {
				try {
					const { apiKey, message, model, apiUrl, useCloud, authToken } =
						await req.json();

					if (!message) {
						return new Response(
							JSON.stringify({ error: "Message is required." }),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}

					let finalApiKey, finalApiUrl, finalModel;

					if (useCloud && authToken) {
						const settings = getSettingsByToken(authToken);
						if (!settings || !settings.api_key) {
							return new Response(
								JSON.stringify({
									error:
										"Cloud mode: No API settings found. Please configure your AI settings in cloud mode.",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							);
						}
						finalApiKey = settings.api_key;
						finalApiUrl = settings.api_url || AI_API_URL;
						finalModel = settings.model || AI_MODEL;
					} else {
						finalApiKey = apiKey || AI_API_KEY;
						finalApiUrl = apiUrl || AI_API_URL;
						finalModel = model || AI_MODEL;
					}

					if (!finalApiKey) {
						return new Response(
							JSON.stringify({ error: "API Key is required." }),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}

					// Call AI API (OpenAI-compatible)
					const requestBody = {
						model: finalModel,
						messages: [{ role: "user", content: message }],
						max_tokens: 150,
						temperature: 0.7,
					};

					const aiResponse = await fetch(finalApiUrl, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${finalApiKey}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(requestBody),
					});

					const aiData = await aiResponse.json();

					if (!aiResponse.ok) {
						return new Response(
							JSON.stringify({
								error: aiData.error?.message || "AI API call failed.",
							}),
							{
								status: aiResponse.status,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const reply =
						aiData.choices?.[0]?.message?.content?.trim() ||
						"AI did not provide a response.";

					return new Response(JSON.stringify({ reply }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (_error) {
					return new Response(
						JSON.stringify({
							error: "Internal server error processing AI request.",
						}),
						{ status: 500, headers: { "Content-Type": "application/json" } },
					);
				}
			}

			// User Registration
			if (url.pathname === "/api/register" && req.method === "POST") {
				try {
					const { username, password } = await req.json();
					if (!username || !password) {
						return new Response(
							JSON.stringify({ error: "Username and password are required." }),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}
					const result = createUser(username, password);
					if (result.success) {
						const token = createSession(result.userId);
						return new Response(
							JSON.stringify({ success: true, token, userId: result.userId }),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							},
						);
					}
					return new Response(JSON.stringify({ error: result.error }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					return new Response(JSON.stringify({ error: error.message }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}
			}

			// User Login
			if (url.pathname === "/api/login" && req.method === "POST") {
				try {
					const { username, password } = await req.json();
					if (!username || !password) {
						return new Response(
							JSON.stringify({ error: "Username and password are required." }),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}
					const result = authenticateUser(username, password);
					if (result.authenticated) {
						const token = createSession(result.userId);
						return new Response(
							JSON.stringify({ success: true, token, userId: result.userId }),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							},
						);
					}
					return new Response(
						JSON.stringify({ error: "Invalid credentials" }),
						{
							status: 401,
							headers: { "Content-Type": "application/json" },
						},
					);
				} catch (error) {
					return new Response(JSON.stringify({ error: error.message }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}
			}

			// Get user settings (for cloud mode)
			if (url.pathname === "/api/user-settings" && req.method === "GET") {
				const authHeader = req.headers.get("Authorization");
				const token = authHeader?.replace("Bearer ", "");

				if (!token) {
					return new Response(JSON.stringify({ error: "Token required" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}
				const session = validateSession(token);

				if (!session) {
					return new Response(
						JSON.stringify({ error: "Invalid or expired token" }),
						{
							status: 401,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				const settings = getUserSettingsByUserId(session.user_id);

				return new Response(
					JSON.stringify({
						username: session.username,
						hasSettings: !!settings,
						settings: settings
							? {
									apiUrl: settings.api_url,
									model: settings.model,
									hasApiKey: !!settings.api_key,
								}
							: null,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Save user settings (for cloud mode)
			if (url.pathname === "/api/user-settings" && req.method === "POST") {
				const authHeader = req.headers.get("Authorization");
				const token = authHeader?.replace("Bearer ", "");

				if (!token) {
					return new Response(JSON.stringify({ error: "Token required" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}
				const body = await req.json();
				const { apiUrl, apiKey, model, settings } = body;

				// Support both formats: { apiUrl, apiKey, model } or { settings: { apiUrl, apiKey, model } }
				const newApiUrl = settings?.apiUrl ?? apiUrl;
				const newApiKey = settings?.apiKey ?? apiKey;
				const newModel = settings?.model ?? model;

				if (!newApiKey) {
					// Get existing settings, don't clear apiKey
					const session = validateSession(token);
					if (!session) {
						return new Response(
							JSON.stringify({ error: "Invalid or expired token" }),
							{
								status: 401,
								headers: { "Content-Type": "application/json" },
							},
						);
					}
					const existingSettings = getUserSettingsByUserId(session.user_id);

					if (!existingSettings?.api_key) {
						return new Response(
							JSON.stringify({ error: "API Key is required" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					// Update only apiUrl and model, keep existing apiKey
					const result = saveSettingsByToken(
						token,
						newApiUrl,
						existingSettings.api_key,
						newModel,
					);

					if (result.success) {
						return new Response(
							JSON.stringify({
								success: true,
								message: "URL and model updated",
							}),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							},
						);
					}
					return new Response(JSON.stringify({ error: result.error }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					});
				}

				const result = saveSettingsByToken(
					token,
					newApiUrl,
					newApiKey,
					newModel,
				);

				if (result.success) {
					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response(JSON.stringify({ error: result.error }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Logout
			if (url.pathname === "/api/logout" && req.method === "POST") {
				const authHeader = req.headers.get("Authorization");
				const token = authHeader?.replace("Bearer ", "");
				if (token) {
					deleteSession(token);
				}
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			// 0.2. Config API endpoint (New)
			if (url.pathname === `/${SUB_PATH}-json`) {
				const configData = {
					UUID: UUID,
					DOMAIN: DOMAIN,
					WSPATH: WSPATH,
					SUB_PATH: SUB_PATH,
					NAME: NAME,
					PORT: PORT, // Added PORT from .env to the config data
				};
				return new Response(JSON.stringify(configData), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			// 0.4. AI Settings API endpoints (Legacy - for backward compatibility)
			if (url.pathname === `/api/ai-settings`) {
				if (req.method === "GET") {
					// Return current AI settings (without sensitive API key)
					const settingsData = {
						apiUrl: AI_API_URL,
						model: AI_MODEL,
						hasApiKey: !!AI_API_KEY, // Only indicate if key is set in env
					};
					return new Response(JSON.stringify(settingsData), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (req.method === "POST") {
					const body = await req.json();
					const { settings, apiUrl, apiKey, model } = body;

					// Support both old format { settings: {...} } and new format { apiUrl, apiKey, model }
					if (!settings && (!apiUrl || !apiKey)) {
						return new Response(
							JSON.stringify({ error: "Settings data is required." }),
							{ status: 400, headers: { "Content-Type": "application/json" } },
						);
					}

					const finalSettings = settings || { apiUrl, apiKey, model };

					return new Response(
						JSON.stringify({
							success: true,
							message: "Settings validated successfully",
							settings: {
								...finalSettings,
								// Don't return sensitive information
								apiKey: undefined,
							},
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			}

			// 1. Subscription endpoint
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

			// Handle API calls that might be 404 (specifically for -json API endpoints)
			// If a path doesn't exist, but it's supposed to be an API endpoint (ending in -json),
			// return 404 JSON to help frontend error handling instead of SPA fallback.
			// This is critical for cases where the SUB_PATH might have changed or been guessed incorrectly.
			if (filePath.endsWith("-json")) {
				return new Response(
					JSON.stringify({
						error: "API Endpoint Not Found",
						message: `No configuration found for subscription path: ${url.pathname}`,
					}),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
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
