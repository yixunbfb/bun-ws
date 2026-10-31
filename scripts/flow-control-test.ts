import { listen } from "bun";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

/**
 * Regression test for end-to-end flow control.
 *
 * The origin sends far faster than the local consumer reads. Without flow
 * control the client buffers everything in memory (64 MiB safety cap) and then
 * kills the connection — which is what made `git clone` over the HTTP proxy
 * fail on large packfiles.
 *
 * The test reads slowly on purpose and verifies that the whole body arrives
 * intact, i.e. the proxy paused/resumed the origin instead of dropping data.
 */

const UUID = "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const WSPATH = UUID.slice(0, 8);
const SERVER_PORT = 18336;
const CLIENT_PORT = 11083;
const ORIGIN_PORT = 18081;
const ROOT = resolve(import.meta.dir, "..");

const BODY_SIZE = 32 * 1024 * 1024; // 32 MiB
const ORIGIN_CHUNK = 64 * 1024;
/** Pause the local socket after each read: emulates a slow disk/consumer. */
const READ_DELAY_MS = 30;

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

async function main() {
	const body = new Uint8Array(BODY_SIZE);
	for (let i = 0; i < body.length; i++) body[i] = (i * 31) & 0xff;
	const bodySum = checksum(body);

	let originPaused = 0;

	const origin = listen({
		hostname: "127.0.0.1",
		port: ORIGIN_PORT,
		socket: {
			open() {},
			data(socket, chunk) {
				const text = new TextDecoder().decode(chunk);
				if (!/^GET \/big /.test(text)) {
					socket.write(new TextEncoder().encode("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"));
					socket.end();
					return;
				}

				socket.write(
					new TextEncoder().encode(
						`HTTP/1.1 200 OK\r\nContent-Length: ${BODY_SIZE}\r\nConnection: close\r\n\r\n`,
					),
				);

				// Push as fast as the OS allows; drain-aware.
				let offset = 0;
				const pump = () => {
					while (offset < body.length) {
						const piece = body.subarray(offset, Math.min(offset + ORIGIN_CHUNK, body.length));
						const written = socket.write(piece);
						if (written <= 0) {
							originPaused++;
							return; // wait for drain
						}
						offset += written;
					}
					socket.end();
				};
				(socket as any).__pump = pump;
				pump();
			},
			drain(socket) {
				(socket as any).__pump?.();
			},
			close() {},
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

	const tmp = mkdtempSync(resolve(tmpdir(), "bvc-flow-test-"));
	const configPath = resolve(tmp, "config.json");
	writeFileSync(
		configPath,
		JSON.stringify({
			log_level: "debug",
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
	await Bun.sleep(900);

	let received = new Uint8Array(0);
	let headerEnd = -1;
	let expected = -1;
	let errorText = "";

	const result = await new Promise<string>((resolvePromise) => {
		Bun.connect({
			hostname: "127.0.0.1",
			port: CLIENT_PORT,
			socket: {
				open(socket: any) {
					socket.write(
						new TextEncoder().encode(
							`GET http://127.0.0.1:${ORIGIN_PORT}/big HTTP/1.1\r\n` +
								`Host: 127.0.0.1:${ORIGIN_PORT}\r\n\r\n`,
						),
					);
				},
				data(socket: any, chunk: Uint8Array) {
					received = concat(received, chunk);

					if (headerEnd < 0) {
						const text = new TextDecoder().decode(received);
						const idx = text.indexOf("\r\n\r\n");
						if (idx < 0) return;
						headerEnd = idx;
						const match = text.match(/content-length:\s*(\d+)/i);
						expected = match ? Number.parseInt(match[1], 10) : -1;
					}

					if (received.length - (headerEnd + 4) >= expected && expected > 0) {
						resolvePromise("done");
						return;
					}

					// Slow consumer: stop reading for a while.
					if (!socket.__paused) {
						socket.__paused = true;
						socket.pause();
						setTimeout(() => {
							socket.__paused = false;
							socket.resume();
						}, READ_DELAY_MS);
					}
				},
				close() {
					resolvePromise("closed");
				},
				error(_socket: any, error: Error) {
					errorText = error.message;
					resolvePromise("error");
				},
			},
		});
		setTimeout(() => resolvePromise("timeout"), 300000);
	});

	await Bun.sleep(300);
	client.kill();
	server.kill();
	origin.stop();
	rmSync(tmp, { recursive: true, force: true });

	const payload = headerEnd >= 0 ? received.subarray(headerEnd + 4) : new Uint8Array(0);
	const payloadSum = checksum(payload.slice(0, BODY_SIZE));

	const checks = {
		"transfer completed": result === "done" && !errorText,
		"full body received": payload.length === BODY_SIZE,
		"body integrity": payloadSum === bodySum,
		"origin applied backpressure": originPaused > 0,
	};

	console.log("=== FLOW CONTROL (SLOW CONSUMER) TEST ===");
	for (const [name, ok] of Object.entries(checks)) {
		console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
	}
	console.log(`result=${result} received=${received.length} payload=${payload.length} originPaused=${originPaused}`);
	console.log("=========================================");

	process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
}

main();
