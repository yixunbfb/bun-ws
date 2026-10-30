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
	const echo = listen({
		hostname: "127.0.0.1",
		port: ECHO_PORT,
		socket: {
			open(s) {
				s.data = { buf: 0 };
				console.log("[echo] client connected");
			},
			data(s, d) {
				s.data.buf += d.length;
				console.log(
					`[echo] got ${d.length} bytes (total ${s.data.buf}): first="${new TextDecoder().decode(d.slice(0, 20))}"`,
				);
				s.write(d);
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
	ws.onmessage = (e: any) => {
		console.log(
			`[client] received ${e.data.byteLength} bytes: "${new TextDecoder().decode(new Uint8Array(e.data).slice(0, 40))}"`,
		);
	};

	ws.send(
		vlessHandshake(
			ECHO_PORT,
			1,
			[127, 0, 0, 1],
			new TextEncoder().encode("GET / HTTP/1.1\r\n\r\n"),
		),
	);
	console.log("[client] handshake sent, waiting for echo...");

	await Bun.sleep(2000);
	ws.close();
	proc.kill();
	echo.stop();
	process.exit(0);
}

main();
