import { listen } from "bun";

const UUID = "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const uuidHex = UUID.replace(/-/g, "");
const WSPATH = "8ea48d91";
const PROXY_PORT = 18333;
const ECHO_PORT = 18001;

const HANDLE = "GET / HTTP/1.1\r\n\r\n";
const ACK_LEN = 2; // VLESS response header (version + zero)

function vlessHandshake(
	port: number,
	atyp: number,
	addr: number[],
	payload: Uint8Array,
): Uint8Array {
	const head = new Uint8Array(22 + addr.length);
	let p = 0;
	head[p++] = 0;
	for (let i = 0; i < 16; i++)
		head[p++] = parseInt(uuidHex.slice(i * 2, i * 2 + 2), 16);
	head[p++] = 0;
	head[p++] = 1;
	head[p++] = (port >> 8) & 0xff;
	head[p++] = port & 0xff;
	head[p++] = atyp;
	for (const b of addr) head[p++] = b;
	const out = new Uint8Array(head.length + payload.length);
	out.set(head);
	out.set(payload, head.length);
	return out;
}

const ADDR = [127, 0, 0, 1];
const TARGET_TOTAL = 256 * 1024 * 1024; // 256 MiB
const CHUNK = 64 * 1024;

function makePRNG(seedIn: number) {
	let seed = seedIn >>> 0;
	return (n: number): Uint8Array => {
		const out = new Uint8Array(n);
		for (let i = 0; i < n; i++) {
			seed ^= seed << 13;
			seed ^= seed >>> 7;
			seed ^= seed << 17;
			out[i] = seed & 0xff;
		}
		return out;
	};
}

// Echo TCP server that honours write() backpressure (does not drop bytes).
function makeEcho() {
	return {
		queue: [] as Uint8Array[],
		paused: false,
		received: 0,
		handleData(socket: any, data: Uint8Array) {
			this.received += data.length;
			if (this.paused) {
				this.queue.push(data);
				return;
			}
			const w = socket.write(data);
			if (w < data.length) {
				this.queue.push(w > 0 ? data.subarray(w) : data);
				this.paused = true;
			}
		},
		handleDrain(socket: any) {
			while (this.queue.length > 0) {
				const chunk = this.queue[0];
				const w = socket.write(chunk);
				if (w < chunk.length) {
					if (w > 0) this.queue[0] = chunk.subarray(w);
					return;
				}
				this.queue.shift();
			}
			this.paused = false;
		},
	};
}

async function main() {
	const echoState = makeEcho();
	const echo = listen({
		hostname: "127.0.0.1",
		port: ECHO_PORT,
		socket: {
			open(socket) {
				socket.data = { state: echoState };
			},
			data(socket, data) {
				(socket.data.state as typeof echoState).handleData(socket, data);
			},
			drain(socket) {
				(socket.data.state as typeof echoState).handleDrain(socket);
			},
		},
	});
	await Bun.sleep(100);

	const proc = Bun.spawn(["bun", "run", "server/index.ts"], {
		env: { ...process.env, PORT: String(PROXY_PORT), UUID, WSPATH },
		stdout: "inherit",
		stderr: "inherit",
	});
	await Bun.sleep(600);

	const ws = new WebSocket(`ws://127.0.0.1:${PROXY_PORT}/${WSPATH}`);
	await new Promise<void>((res, rej) => {
		ws.onopen = () => res();
		ws.onerror = () => rej(new Error("ws open error"));
	});

	// VLESS handshake with a small HTTP request (echoed back first)
	const prng = makePRNG(0x9e3779b9);
	let recvTotal = 0;
	const recvChunks: Uint8Array[] = [];
	let wsErrors = 0;
	let wsClosedEarly = false;

	ws.onmessage = (e: any) => {
		const d = new Uint8Array(e.data);
		recvChunks.push(d);
		recvTotal += d.length;
	};
	ws.onerror = () => wsErrors++;
	ws.onclose = (e: any) => {
		if (recvTotal < TARGET_TOTAL + ACK_LEN + HANDLE.length)
			wsClosedEarly = true;
	};

	ws.send(vlessHandshake(ECHO_PORT, 1, ADDR, new TextEncoder().encode(HANDLE)));
	await Bun.sleep(300);

	// Send concurrently while receiving (like git push)
	const sendStart = performance.now();
	const totalMsgs = TARGET_TOTAL / CHUNK;
	for (let i = 0; i < totalMsgs; i++) {
		const chunk = prng(CHUNK);
		ws.send(chunk);
		if (i % 4 === 0) await Bun.sleep(0);
	}
	const sendMs = performance.now() - sendStart;

	// Wait for ACK + handshake echo + all data to come back
	const t0 = performance.now();
	while (
		recvTotal < TARGET_TOTAL + ACK_LEN + HANDLE.length &&
		performance.now() - t0 < 120_000
	) {
		if (wsClosedEarly) break;
		await Bun.sleep(20);
	}
	const roundTripMs = performance.now() - t0;

	// Assemble received stream
	const expectedLen = TARGET_TOTAL + ACK_LEN + HANDLE.length;
	const received = new Uint8Array(Math.min(recvTotal, expectedLen));
	let off = 0;
	for (const c of recvChunks) {
		if (off >= received.length) break;
		const n = Math.min(c.length, received.length - off);
		received.set(c.subarray(0, n), off);
		off += n;
	}

	// Build expected stream: VLESS ACK (2), handshake echo (18), then PRNG data
	const expected = new Uint8Array(expectedLen);
	expected.set([0, 0], 0);
	expected.set(new TextEncoder().encode(HANDLE), ACK_LEN);
	const prng2 = makePRNG(0x9e3779b9);
	for (let i = 0; i < totalMsgs; i++) {
		const c = prng2(CHUNK);
		expected.set(c, ACK_LEN + HANDLE.length + i * CHUNK);
	}

	let mismatch = -1;
	for (let j = 0; j < expected.length; j++) {
		if (received[j] !== expected[j]) {
			mismatch = j;
			break;
		}
	}

	console.log("=== LARGE TRANSFER TEST ===");
	console.log(
		`target: ${TARGET_TOTAL} bytes + ${HANDLE.length} handshake echo`,
	);
	console.log(`echo server received: ${echoState.received} bytes`);
	console.log(`ws received: ${recvTotal} bytes`);
	console.log(`ws errors: ${wsErrors}, ws closed early: ${wsClosedEarly}`);
	console.log(
		`send time: ${sendMs.toFixed(0)}ms (${(TARGET_TOTAL / 1048576 / (sendMs / 1000)).toFixed(1)} MiB/s up)`,
	);
	console.log(`round-trip: ${roundTripMs.toFixed(0)}ms`);
	console.log(
		`integrity: ${mismatch === -1 ? "OK" : `MISMATCH at byte ${mismatch} (expected ${expected[mismatch]}, got ${received[mismatch]})`}`,
	);
	console.log(`received === sent: ${recvTotal === expectedLen}`);
	console.log("===========================");

	ws.close();
	proc.kill();
	echo.stop();
	process.exit(recvTotal === expectedLen && mismatch === -1 ? 0 : 1);
}

main();
