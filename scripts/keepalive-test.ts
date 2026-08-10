import { listen } from "bun";

const UUID = "8ea48d91-eab2-4dfa-9169-859b0d43b3dc";
const uuidHex = UUID.replace(/-/g, "");
const WSPATH = "8ea48d91";
const PROXY_PORT = 18333;
const ECHO_PORT = 18001;

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

async function main() {
	let echoTotal = 0;
	let echoSawKeepalive = false;
	const echo = listen({
		hostname: "127.0.0.1",
		port: ECHO_PORT,
		socket: {
			open(s) {
				console.log("[echo] client connected");
			},
			data(s, d) {
				echoTotal += d.length;
				const text = new TextDecoder().decode(d);
				if (text.includes("keepalive")) echoSawKeepalive = true;
				console.log(
					`[echo] got ${d.length} bytes (total ${echoTotal}): "${text.slice(0, 20)}"`,
				);
				s.write(d);
			},
		},
	});
	await Bun.sleep(100);

	const proc = Bun.spawn(["bun", "run", "index.ts"], {
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

	const received: string[] = [];
	ws.onmessage = (e: any) => {
		if (typeof e.data === "string") {
			received.push(e.data);
		} else {
			received.push(`bytes:${new TextDecoder().decode(e.data)}`);
		}
	};

	// Establish VLESS tunnel to echo
	ws.send(
		vlessHandshake(
			ECHO_PORT,
			1,
			[127, 0, 0, 1],
			new TextEncoder().encode("GET / HTTP/1.1\r\n\r\n"),
		),
	);
	await Bun.sleep(500);

	// Application-layer keepalive must be answered, not forwarded
	ws.send(JSON.stringify({ type: "keepalive" }));
	await Bun.sleep(500);

	// Real data after keepalive must still round-trip intact
	ws.send(new TextEncoder().encode("HELLO"));
	await Bun.sleep(500);

	ws.close();
	proc.kill();
	echo.stop();

	const pong = received.includes(JSON.stringify({ type: "keepalive", pong: true }));
	const hello = received.includes("bytes:HELLO");
	console.log(`keepalive pong received: ${pong}`);
	console.log(`echo payload received intact: ${hello}`);
	console.log(`keepalive NOT forwarded to origin: ${!echoSawKeepalive}`);
	console.log(`origin saw exactly ${echoTotal} bytes (18 handshake echo + 5 HELLO = 23): ${echoTotal === 23}`);
	console.log(pong && hello && !echoSawKeepalive && echoTotal === 23 ? "PASS" : "FAIL");
	process.exit(pong && hello && !echoSawKeepalive && echoTotal === 23 ? 0 : 1);
}

main();
