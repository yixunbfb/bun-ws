import { listen } from "bun";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

/**
 * Regression test for the HTTP (forward proxy) path.
 *
 * Starts the VLESS server, the VLESS client in HTTP-proxy mode, and an origin
 * HTTP server. Sends a large POST body and verifies:
 *   - the origin receives every body byte (no early-data loss),
 *   - the request was rewritten to origin-form (not an absolute URI),
 *   - proxy-only headers were stripped and `Connection: close` was added.
 */

const UUID = "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const WSPATH = UUID.slice(0, 8);
const SERVER_PORT = 18334;
const CLIENT_PORT = 11082;
const ORIGIN_PORT = 18080;
const ROOT = resolve(import.meta.dir, "..");

const BODY_SIZE = 4 * 1024 * 1024;
const CHUNK = 64 * 1024;

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
	const out = new Uint8Array(a.length + b.length);
	out.set(a);
	out.set(b, a.length);
	return out;
}

function checksum(data: Uint8Array): number {
	let sum = 0;
	for (let i = 0; i < data.length; i++) sum = (sum + data[i]) >>> 0;
	return sum;
}

function expectedResponse(bodyLength: number): string {
	return `OK:${bodyLength}`;
}

async function main() {
	const body = new Uint8Array(BODY_SIZE);
	for (let i = 0; i < body.length; i++) body[i] = i & 0xff;
	const bodySum = checksum(body);

	let received = new Uint8Array(0);
	let headerText = "";
	let headerEndIndex = -1;
	let needed = -1;
	let replied = false;
	let requestLine = "";
	let connectionHeader = "";
	let proxyConnectionHeader = "";
	let originBodySum = 0;

	const origin = listen({
		hostname: "127.0.0.1",
		port: ORIGIN_PORT,
		socket: {
			data(socket, chunk) {
				if (replied) return;
				received = concat(received, chunk);

				if (needed < 0) {
					const text = new TextDecoder().decode(received);
					const headerEnd = text.indexOf("\r\n\r\n");
					if (headerEnd < 0) return;

					const lines = text.slice(0, headerEnd).split("\r\n");
					requestLine = lines[0];
					headerText = text.slice(0, headerEnd);
					headerEndIndex = headerEnd;
					connectionHeader = lines.find((l) => /^connection:/i.test(l)) ?? "";
					proxyConnectionHeader = lines.find((l) => /^proxy-connection:/i.test(l)) ?? "";

					const match = headerText.match(/content-length:\s*(\d+)/i);
					const contentLength = match ? Number.parseInt(match[1], 10) : 0;
					needed = headerEnd + 4 + contentLength;
				}

				if (received.length < needed) return;

				const payload = received.subarray(headerEndIndex + 4);
				originBodySum = checksum(payload);

				const responseBody = expectedResponse(payload.length);
				const response = `HTTP/1.1 200 OK\r\nContent-Length: ${responseBody.length}\r\nConnection: close\r\n\r\n${responseBody}`;
				replied = true;
				socket.write(new TextEncoder().encode(response));
				socket.end();
			},
			open() {},
		},
	});
	await Bun.sleep(100);

	const server = Bun.spawn(["bun", "run", "server/index.ts"], {
		cwd: ROOT,
		env: { ...process.env, PORT: String(SERVER_PORT), UUID, WSPATH },
		stdout: "inherit",
		stderr: "inherit",
	});
	await Bun.sleep(600);

	const tmp = mkdtempSync(resolve(tmpdir(), "bvc-http-test-"));
	const configPath = resolve(tmp, "config.json");
	writeFileSync(
		configPath,
		JSON.stringify({
			log_level: "error",
			local_port: CLIENT_PORT,
			timeout: 10000,
			remote: { host: "127.0.0.1", port: SERVER_PORT, uuid: UUID },
			tls: { enabled: false },
			transport: { type: "ws", path: `/${WSPATH}`, host: "127.0.0.1" },
		}),
	);

	const client = Bun.spawn(["bun", "run", "client/bun-vlessclient.ts", "-c", configPath], {
		cwd: ROOT,
		stdout: "inherit",
		stderr: "inherit",
	});
	await Bun.sleep(800);

	let responseText = "";
	let clientError = "";
	let sentBodyOffset = 0;

	const pumpBody = (socket: any) => {
		while (sentBodyOffset < body.length) {
			const chunk = body.subarray(sentBodyOffset, Math.min(sentBodyOffset + CHUNK, body.length));
			const written = socket.write(chunk);
			if (written === -1) return;
			if (written < chunk.length) {
				sentBodyOffset += Math.max(written, 0);
				return; // wait for drain
			}
			sentBodyOffset += chunk.length;
		}
	};

	const result = await new Promise<string>((resolvePromise) => {
		Bun.connect({
			hostname: "127.0.0.1",
			port: CLIENT_PORT,
			socket: {
				open(socket: any) {
					const headers =
						`POST http://127.0.0.1:${ORIGIN_PORT}/upload HTTP/1.1\r\n` +
						`Host: 127.0.0.1:${ORIGIN_PORT}\r\n` +
						`Proxy-Connection: keep-alive\r\n` +
						`Content-Length: ${BODY_SIZE}\r\n\r\n`;
					socket.write(new TextEncoder().encode(headers));

					// Send immediately, before/while the VLESS WS handshake runs.
					pumpBody(socket);
				},
				drain(socket: any) {
					pumpBody(socket);
				},
				data(_socket: any, chunk: Uint8Array) {
					responseText += new TextDecoder().decode(chunk);
				},
				close() {
					resolvePromise("closed");
				},
				error(_socket: any, error: Error) {
					clientError = error.message;
					resolvePromise("error");
				},
			},
		});
		setTimeout(() => resolvePromise("timeout"), 30000);
	});

	await Bun.sleep(200);
	client.kill();
	server.kill();
	origin.stop();
	rmSync(tmp, { recursive: true, force: true });

	const expected = expectedResponse(BODY_SIZE);

	const checks = {
		"connection finished": result === "closed" && !clientError,
		"origin received full body": originBodySum === bodySum,
		"origin saw origin-form request": requestLine === "POST /upload HTTP/1.1",
		"proxy-connection stripped": proxyConnectionHeader === "",
		"connection: close added": /^connection:\s*close$/i.test(connectionHeader),
		"client got 200 response": responseText.includes("200 OK") && responseText.includes(expected),
	};

	console.log("=== HTTP PROXY LARGE POST TEST ===");
	console.log(`result=${result} clientError=${JSON.stringify(clientError)}`);
	console.log(`origin received=${received.length} needed=${needed} sum=${originBodySum} expectedSum=${bodySum}`);
	for (const [name, ok] of Object.entries(checks)) {
		console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
	}
	console.log(`request line: ${JSON.stringify(requestLine)}`);
	console.log(`response: ${JSON.stringify(responseText.slice(0, 80))}`);
	console.log("=================================");

	const ok = Object.values(checks).every(Boolean);
	process.exit(ok ? 0 : 1);
}

main();
