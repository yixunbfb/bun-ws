const a0_0x36bc41 = a0_0x552a;
function a0_0x552a(_0x2d83a5, _0x475ae5) {
	_0x2d83a5 = _0x2d83a5 - 0x158;
	const _0x2b7b1d = a0_0x2b7b();
	const _0x552a71 = _0x2b7b1d[_0x2d83a5];
	return _0x552a71;
}
((_0x2aae81, _0x4826a3) => {
	const _0xb1ad98 = a0_0x552a,
		_0x51f92f = _0x2aae81();
	while ([]) {
		try {
			const _0x1e158b =
				(-parseInt(_0xb1ad98(0x1ba), 10) / 0x1) *
					(-parseInt(_0xb1ad98(0x1b7), 10) / 0x2) +
				(-parseInt(_0xb1ad98(0x15d), 10) / 0x3) *
					(-parseInt(_0xb1ad98(0x187), 10) / 0x4) +
				-parseInt(_0xb1ad98(0x199), 10) / 0x5 +
				-parseInt(_0xb1ad98(0x1a5), 10) / 0x6 +
				-parseInt(_0xb1ad98(0x1c2), 10) / 0x7 +
				(-parseInt(_0xb1ad98(0x1c0), 10) / 0x8) *
					(parseInt(_0xb1ad98(0x193), 10) / 0x9) +
				(-parseInt(_0xb1ad98(0x164), 10) / 0xa) *
					(-parseInt(_0xb1ad98(0x1c4), 10) / 0xb);
			if (_0x1e158b === _0x4826a3) break;
			else _0x51f92f.push(_0x51f92f.shift());
		} catch (_0x7e6620) {
			_0x51f92f.push(_0x51f92f.shift());
		}
	}
})(a0_0x2b7b, 0x281e0);

import { join } from "node:path";
import { serve } from "bun";
import {
	authenticateUser,
	createSession,
	createUser,
	getSettingsByToken,
	getUserSettingsByUserId,
	saveSettingsByToken,
	validateSession,
} from "./db.js";

function a0_0x2b7b() {
	const _0x22011b = [
		"digest",
		"send",
		"Settings\x20validated\x20successfully",
		"18pvvQaq",
		"undefined",
		"/api/user-settings",
		"Settings\x20data\x20is\x20required.",
		"map",
		"API\x20Endpoint\x20Not\x20Found",
		"835250paWMaA",
		"public,\x20max-age=3600",
		"application/json",
		"Bearer\x20",
		"padStart",
		"/public",
		"Internal\x20server\x20error\x20processing\x20AI\x20request.",
		"/api/ai-settings",
		"No\x20configuration\x20found\x20for\x20subscription\x20path:\x20",
		"close",
		"slice",
		"user_id",
		"481884TRAaqr",
		"/api/register",
		"Username\x20and\x20password\x20are\x20required.",
		"includes",
		"file",
		"endsWith",
		"decode",
		"apiKey",
		"success",
		"toString",
		"toLowerCase",
		"GET",
		"api_url",
		"url",
		"length",
		"destroy",
		"connect",
		"error",
		"77428yGesFW",
		"text/html;\x20charset=utf-8",
		"get",
		"3qYyNkz",
		"json",
		"vless://",
		"message",
		"upgrade",
		"write",
		"790184RiECyF",
		"pathname",
		"550991iRhahQ",
		"Invalid\x20or\x20expired\x20token",
		"55bmgASb",
		"from",
		"/api/ai-chat",
		"text/plain;\x20charset=utf-8",
		"https://api.openai.com/v1/chat/completions",
		"readUInt16BE",
		"/api/login",
		"concat",
		"bun-ws",
		"&encryption=none",
		"address",
		"582ynankY",
		"404\x20Not\x20Found",
		"replace",
		"join",
		"encode",
		"socket",
		"SHA-224",
		"984910oFRQfh",
		"headers",
		"no-cache",
		"stringify",
		"content",
		"/api/set-key",
		"Authorization",
		"base64",
		"model",
		"every",
		"&fp=chrome&type=ws&host=",
		"Request\x20handling\x20error:\x20",
		"ws.bun-ws.com",
		"Message\x20is\x20required.",
		"Failed\x20to\x20resolve\x20",
		"Token\x20required",
		"authenticated",
		"status",
		"text/plain",
		"/index.html",
		":443",
		"lookup",
		"AI\x20did\x20not\x20provide\x20a\x20response.",
		"timeout",
		"/api/logout",
		"TCP\x20connection\x20failed:",
		"choices",
		"Internal\x20Server\x20Error",
		"&path=%2F",
		"8ea48d91-eab2-4dfa-9169-859b0d43b3dc",
		"apiUrl",
		"API\x20Key\x20is\x20required",
		"exists",
		"method",
		"api_key",
		"1636YCrQqP",
		"Cloud\x20mode:\x20No\x20API\x20settings\x20found.\x20Please\x20configure\x20your\x20AI\x20settings\x20in\x20cloud\x20mode.",
		"userId",
		"trim",
		"-json",
		"POST",
		"user",
		"data",
		"username",
	];
	a0_0x2b7b = () => _0x22011b;
	return a0_0x2b7b();
}
const UUID = process.env.UUID || a0_0x36bc41(0x181),
	DOMAIN = process.env.DOMAIN || a0_0x36bc41(0x170),
	WSPATH = process.env.WSPATH || UUID[a0_0x36bc41(0x1a3)](0x0, 0x8),
	SUB_PATH = process.env.SUB_PATH || UUID[a0_0x36bc41(0x1a3)](0x9, 0xd),
	NAME = process.env.NAME || a0_0x36bc41(0x15a),
	PORT = process.env.PORT || 0x208d,
	AI_API_URL = process.env.AI_API_URL || a0_0x36bc41(0x1c8),
	AI_API_KEY = process.env.AI_API_KEY || "",
	AI_MODEL = process.env.AI_MODEL || "gpt-3.5-turbo",
	uuid = UUID[a0_0x36bc41(0x15f)](/-/g, ""),
	STATIC_DIR = import.meta.dir + a0_0x36bc41(0x19e);
async function resolveHost(_0x473717) {
	const _0x597433 = a0_0x36bc41,
		_0x1a7ff3 = Bun.isIP(_0x473717);
	if (_0x1a7ff3 === 0x4 || _0x1a7ff3 === 0x6) return _0x473717;
	try {
		const _0x353b72 = await Bun.dns[_0x597433(0x179)](_0x473717, {
			family: 0x4,
			signal: AbortSignal[_0x597433(0x17b)](0xbb8),
		});
		return _0x353b72[0x0][_0x597433(0x15c)];
	} catch (_0x58864f) {
		throw new Error(
			`${_0x597433(0x172) + _0x473717}:\x20${_0x58864f[_0x597433(0x1bd)]}`,
		);
	}
}
async function establishTcpConnection(
	_0x3704d9,
	_0x252dd1,
	_0x1336eb,
	_0x1b9bc4,
) {
	const _0x3fef85 = a0_0x36bc41;
	try {
		const _0x41d61b = await resolveHost(_0x252dd1),
			_0xf631f3 = await Bun[_0x3fef85(0x1b5)]({
				hostname: _0x41d61b,
				port: _0x1336eb,
				socket: {
					open: (_0x5e6751) => {
						const _0x465bdf = _0x3fef85;
						_0x3704d9[_0x465bdf(0x18e)].socket = _0x5e6751;
						if (_0x1b9bc4.length > 0x0) _0x5e6751[_0x465bdf(0x1bf)](_0x1b9bc4);
					},
					data: (_0x99851, _0x1d9a8c) => {
						_0x3704d9.send(_0x1d9a8c);
					},
					close: () => _0x3704d9.close(),
					error: () => _0x3704d9[_0x3fef85(0x1a2)](),
					drain: () => {},
					end: () => _0x3704d9[_0x3fef85(0x1a2)](),
				},
			});
	} catch (_0x382d69) {
		console[_0x3fef85(0x1b6)](_0x3fef85(0x17d), _0x382d69), _0x3704d9.close();
	}
}
function parseAddress(_0x1023f8, _0x7bff55, _0x15e7fa) {
	const _0x55eaba = a0_0x36bc41;
	let _0x26b144;
	if (_0x1023f8 === 0x1)
		(_0x26b144 = _0x7bff55[_0x55eaba(0x1a3)](_0x15e7fa, _0x15e7fa + 0x4)[
			_0x55eaba(0x160)
		](".")),
			(_0x15e7fa += 0x4);
	else {
		if (_0x1023f8 === 0x2) {
			const _0x14a0d3 = _0x7bff55[_0x15e7fa];
			(_0x15e7fa += 0x1),
				(_0x26b144 = _0x7bff55[_0x55eaba(0x1a3)](
					_0x15e7fa,
					_0x15e7fa + _0x14a0d3,
				)[_0x55eaba(0x1ae)]()),
				(_0x15e7fa += _0x14a0d3);
		} else {
			if (_0x1023f8 === 0x3)
				(_0x26b144 = _0x7bff55
					.slice(_0x15e7fa, _0x15e7fa + 0x10)
					.reduce(
						(_0x37071c, _0x462aa2, _0x24556d, _0x5be3c3) =>
							_0x24556d % 0x2
								? _0x37071c[_0x55eaba(0x159)](
										_0x5be3c3[_0x55eaba(0x1a3)](
											_0x24556d - 0x1,
											_0x24556d + 0x1,
										),
									)
								: _0x37071c,
						[],
					)
					[_0x55eaba(0x197)]((_0x39a0ac) =>
						_0x39a0ac[_0x55eaba(0x1c9)](0x0)[_0x55eaba(0x1ae)](0x10),
					)
					[_0x55eaba(0x160)](":")),
					(_0x15e7fa += 0x10);
			else return ![];
		}
	}
	return { host: _0x26b144, offset: _0x15e7fa };
}
function handleVlessConnection(_0xc666, _0x85087e) {
	const _0x4400c3 = a0_0x36bc41;
	try {
		if (_0x85087e[_0x4400c3(0x1b3)] <= 0x11 || _0x85087e[0x0] !== 0x0)
			return ![];
		const _0x4a0a57 = _0x85087e[_0x4400c3(0x1a3)](0x1, 0x11);
		if (
			!_0x4a0a57[_0x4400c3(0x16d)](
				(_0x5d5b80, _0x5898f0) =>
					_0x5d5b80 ===
					parseInt(
						uuid[_0x4400c3(0x1a3)](_0x5898f0 * 0x2, _0x5898f0 * 0x2 + 0x2),
						0x10,
					),
			)
		)
			return ![];
		let _0x210949 = 0x11;
		const _0x17dfb4 = _0x85087e[_0x210949++];
		_0x210949 += _0x17dfb4;
		const _0x4dba55 = _0x85087e[_0x210949++],
			_0x4ebbfc = (_0x85087e[_0x210949++] << 0x8) | _0x85087e[_0x210949++],
			_0x325472 = _0x85087e[_0x210949++],
			{ host: _0x3bfbf4, offset: _0x4cc324 } = parseAddress(
				_0x325472,
				_0x85087e,
				_0x210949,
			);
		(_0x210949 = _0x4cc324),
			_0xc666[_0x4400c3(0x191)](new Uint8Array([_0x85087e[0x0], 0x0]));
		const _0x2316ed = _0x85087e.slice(_0x210949);
		return (
			establishTcpConnection(_0xc666, _0x3bfbf4, _0x4ebbfc, _0x2316ed), !![]
		);
	} catch (_0x4ad3d2) {
		return ![];
	}
}
async function handleTrojanConnection(_0x4dab9c, _0x249847) {
	const _0x5edb0d = a0_0x36bc41;
	try {
		if (_0x249847[_0x5edb0d(0x1b3)] < 0x3a) return ![];
		const _0x1c2d3e = new TextDecoder()[_0x5edb0d(0x1ab)](
				_0x249847[_0x5edb0d(0x1a3)](0x0, 0x38),
			),
			_0x5817a7 = await crypto.subtle[_0x5edb0d(0x190)](
				_0x5edb0d(0x163),
				new TextEncoder()[_0x5edb0d(0x161)](UUID),
			),
			_0x573588 = Array[_0x5edb0d(0x1c5)](new Uint8Array(_0x5817a7))
				[_0x5edb0d(0x197)]((_0x29f20a) =>
					_0x29f20a[_0x5edb0d(0x1ae)](0x10)[_0x5edb0d(0x19d)](0x2, "0"),
				)
				[_0x5edb0d(0x160)]("");
		if (_0x1c2d3e[_0x5edb0d(0x1af)]() !== _0x573588.toLowerCase()) return ![];
		let _0x513c12 = 0x38;
		if (_0x249847[_0x513c12] === 0xd && _0x249847[_0x513c12 + 0x1] === 0xa)
			_0x513c12 += 0x2;
		const _0x1701cc = _0x249847[_0x513c12++];
		if (_0x1701cc !== 0x1) return ![];
		const _0x5c6213 = _0x249847[_0x513c12++],
			_0x221c86 = { 1: 0x1, 3: 0x2, 4: 0x3 },
			{ host: _0x5f0a13, offset: _0x44340c } = parseAddress(
				_0x221c86[_0x5c6213],
				_0x249847,
				_0x513c12,
			);
		_0x513c12 = _0x44340c;
		const _0x5caa6a = (_0x249847[_0x513c12++] << 0x8) | _0x249847[_0x513c12++];
		if (
			_0x513c12 < _0x249847[_0x5edb0d(0x1b3)] &&
			_0x249847[_0x513c12] === 0xd &&
			_0x249847[_0x513c12 + 0x1] === 0xa
		)
			_0x513c12 += 0x2;
		const _0x53e1cb = _0x249847[_0x5edb0d(0x1a3)](_0x513c12);
		return (
			establishTcpConnection(_0x4dab9c, _0x5f0a13, _0x5caa6a, _0x53e1cb), !![]
		);
	} catch (_0x3d312d) {
		return ![];
	}
}
function getSub() {
	const _0x41a360 = a0_0x36bc41,
		_0x2a7db9 =
			"?security=tls&sni=" +
			DOMAIN +
			_0x41a360(0x16e) +
			DOMAIN +
			_0x41a360(0x180) +
			WSPATH +
			"#" +
			encodeURIComponent(NAME),
		_0x33abbf =
			_0x41a360(0x1bc) +
			UUID +
			"@" +
			DOMAIN +
			_0x41a360(0x178) +
			_0x2a7db9 +
			_0x41a360(0x15b),
		_0xff2956 = `trojan://${UUID}@${DOMAIN}${_0x41a360(0x178)}${_0x2a7db9}`;
	return Buffer.from(`${_0x33abbf}\x0a${_0xff2956}`)[_0x41a360(0x1ae)](
		_0x41a360(0x16b),
	);
}
console.log(`Server\x20running\x20on\x20port\x20${PORT}`),
	serve({
		port: PORT,
		reusePort: !![],
		development: ![],
		async fetch(_0x42ba73, _0x22016d) {
			const _0x3b7a6e = a0_0x36bc41,
				_0x17511a = new URL(_0x42ba73[_0x3b7a6e(0x1b2)]);
			try {
				if (
					_0x17511a.pathname === _0x3b7a6e(0x169) &&
					_0x42ba73[_0x3b7a6e(0x185)] === _0x3b7a6e(0x18c)
				) {
				}
				if (
					_0x17511a[_0x3b7a6e(0x1c1)] === _0x3b7a6e(0x1c6) &&
					_0x42ba73.method === "POST"
				)
					try {
						const {
							apiKey: _0x1ab571,
							message: _0x13b820,
							model: _0x50ea7b,
							apiUrl: _0x6b4c13,
							useCloud: _0x14f8c3,
							authToken: _0x15882d,
						} = await _0x42ba73[_0x3b7a6e(0x1bb)]();
						if (!_0x13b820)
							return new Response(
								JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x171) }),
								{
									status: 0x190,
									headers: { "Content-Type": _0x3b7a6e(0x19b) },
								},
							);
						let _0xe24ee8, _0x408a6b, _0x28d6d1;
						if (_0x14f8c3 && _0x15882d) {
							const _0x48d9e3 = getSettingsByToken(_0x15882d);
							if (!_0x48d9e3 || !_0x48d9e3[_0x3b7a6e(0x186)])
								return new Response(
									JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x188) }),
									{
										status: 0x190,
										headers: { "Content-Type": _0x3b7a6e(0x19b) },
									},
								);
							(_0xe24ee8 = _0x48d9e3[_0x3b7a6e(0x186)]),
								(_0x408a6b = _0x48d9e3[_0x3b7a6e(0x1b1)] || AI_API_URL),
								(_0x28d6d1 = _0x48d9e3[_0x3b7a6e(0x16c)] || AI_MODEL);
						} else
							(_0xe24ee8 = _0x1ab571 || AI_API_KEY),
								(_0x408a6b = _0x6b4c13 || AI_API_URL),
								(_0x28d6d1 = _0x50ea7b || AI_MODEL);
						if (!_0xe24ee8)
							return new Response(
								JSON.stringify({ error: "API\x20Key\x20is\x20required." }),
								{
									status: 0x190,
									headers: { "Content-Type": _0x3b7a6e(0x19b) },
								},
							);
						const _0x2afed6 = {
								model: _0x28d6d1,
								messages: [{ role: _0x3b7a6e(0x18d), content: _0x13b820 }],
								max_tokens: 0x96,
								temperature: 0.7,
							},
							_0x397f1c = await fetch(_0x408a6b, {
								method: _0x3b7a6e(0x18c),
								headers: {
									Authorization: _0x3b7a6e(0x19c) + _0xe24ee8,
									"Content-Type": "application/json",
								},
								body: JSON.stringify(_0x2afed6),
							}),
							_0x50df8b = await _0x397f1c[_0x3b7a6e(0x1bb)]();
						if (!_0x397f1c.ok)
							return new Response(
								JSON[_0x3b7a6e(0x167)]({
									error:
										_0x50df8b.error?.[_0x3b7a6e(0x1bd)] ||
										"AI\x20API\x20call\x20failed.",
								}),
								{
									status: _0x397f1c[_0x3b7a6e(0x175)],
									headers: { "Content-Type": _0x3b7a6e(0x19b) },
								},
							);
						const _0x67d29e =
							_0x50df8b[_0x3b7a6e(0x17e)]?.[0x0]?.message?.[_0x3b7a6e(0x168)]?.[
								_0x3b7a6e(0x18a)
							]() || _0x3b7a6e(0x17a);
						return new Response(JSON[_0x3b7a6e(0x167)]({ reply: _0x67d29e }), {
							status: 0xc8,
							headers: { "Content-Type": "application/json" },
						});
					} catch (_0x10f4fa) {
						return new Response(JSON.stringify({ error: _0x3b7a6e(0x19f) }), {
							status: 0x1f4,
							headers: { "Content-Type": "application/json" },
						});
					}
				if (
					_0x17511a[_0x3b7a6e(0x1c1)] === _0x3b7a6e(0x1a6) &&
					_0x42ba73[_0x3b7a6e(0x185)] === _0x3b7a6e(0x18c)
				)
					try {
						const { username: _0x75a9f4, password: _0x4f728d } =
							await _0x42ba73.json();
						if (!_0x75a9f4 || !_0x4f728d)
							return new Response(
								JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x1a7) }),
								{
									status: 0x190,
									headers: { "Content-Type": _0x3b7a6e(0x19b) },
								},
							);
						const _0x2ad7cf = createUser(_0x75a9f4, _0x4f728d);
						if (_0x2ad7cf[_0x3b7a6e(0x1ad)]) {
							const _0x1d818f = createSession(_0x2ad7cf[_0x3b7a6e(0x189)]);
							return new Response(
								JSON[_0x3b7a6e(0x167)]({
									success: !![],
									token: _0x1d818f,
									userId: _0x2ad7cf[_0x3b7a6e(0x189)],
								}),
								{ status: 0xc8, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
							);
						}
						return new Response(
							JSON.stringify({ error: _0x2ad7cf[_0x3b7a6e(0x1b6)] }),
							{ status: 0x190, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					} catch (_0x1ef48a) {
						return new Response(
							JSON[_0x3b7a6e(0x167)]({ error: _0x1ef48a[_0x3b7a6e(0x1bd)] }),
							{ status: 0x1f4, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					}
				if (
					_0x17511a[_0x3b7a6e(0x1c1)] === _0x3b7a6e(0x158) &&
					_0x42ba73[_0x3b7a6e(0x185)] === _0x3b7a6e(0x18c)
				)
					try {
						const { username: _0x56292c, password: _0x2a9010 } =
							await _0x42ba73[_0x3b7a6e(0x1bb)]();
						if (!_0x56292c || !_0x2a9010)
							return new Response(
								JSON.stringify({
									error: "Username\x20and\x20password\x20are\x20required.",
								}),
								{
									status: 0x190,
									headers: { "Content-Type": "application/json" },
								},
							);
						const _0x5f3351 = authenticateUser(_0x56292c, _0x2a9010);
						if (_0x5f3351[_0x3b7a6e(0x174)]) {
							const _0x2702a3 = createSession(_0x5f3351[_0x3b7a6e(0x189)]);
							return new Response(
								JSON.stringify({
									success: !![],
									token: _0x2702a3,
									userId: _0x5f3351[_0x3b7a6e(0x189)],
								}),
								{ status: 0xc8, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
							);
						}
						return new Response(
							JSON[_0x3b7a6e(0x167)]({ error: "Invalid\x20credentials" }),
							{ status: 0x191, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					} catch (_0x39f184) {
						return new Response(
							JSON.stringify({ error: _0x39f184[_0x3b7a6e(0x1bd)] }),
							{ status: 0x1f4, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					}
				if (
					_0x17511a[_0x3b7a6e(0x1c1)] === _0x3b7a6e(0x195) &&
					_0x42ba73[_0x3b7a6e(0x185)] === _0x3b7a6e(0x1b0)
				) {
					const _0x39b5e3 = _0x42ba73[_0x3b7a6e(0x165)][_0x3b7a6e(0x1b9)](
							_0x3b7a6e(0x16a),
						),
						_0x51565f = _0x39b5e3?.[_0x3b7a6e(0x15f)]("Bearer\x20", "");
					if (!_0x51565f)
						return new Response(JSON.stringify({ error: _0x3b7a6e(0x173) }), {
							status: 0x191,
							headers: { "Content-Type": _0x3b7a6e(0x19b) },
						});
					const _0x533867 = validateSession(_0x51565f);
					if (!_0x533867)
						return new Response(
							JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x1c3) }),
							{ status: 0x191, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					const _0x50b4af = getUserSettingsByUserId(
						_0x533867[_0x3b7a6e(0x1a4)],
					);
					return new Response(
						JSON[_0x3b7a6e(0x167)]({
							username: _0x533867[_0x3b7a6e(0x18f)],
							hasSettings: !!_0x50b4af,
							settings: _0x50b4af
								? {
										apiUrl: _0x50b4af[_0x3b7a6e(0x1b1)],
										model: _0x50b4af.model,
										hasApiKey: !!_0x50b4af.api_key,
									}
								: null,
						}),
						{ status: 0xc8, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
					);
				}
				if (
					_0x17511a.pathname === _0x3b7a6e(0x195) &&
					_0x42ba73[_0x3b7a6e(0x185)] === "POST"
				) {
					const _0x3a758d = _0x42ba73[_0x3b7a6e(0x165)][_0x3b7a6e(0x1b9)](
							_0x3b7a6e(0x16a),
						),
						_0x6c4f42 = _0x3a758d?.[_0x3b7a6e(0x15f)]("Bearer\x20", "");
					if (!_0x6c4f42)
						return new Response(
							JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x173) }),
							{ status: 0x191, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					const _0x342f63 = await _0x42ba73.json(),
						{
							apiUrl: _0x1516a4,
							apiKey: _0x4124c9,
							model: _0x29dc29,
							settings: _0x36855b,
						} = _0x342f63,
						_0x399ceb = _0x36855b?.[_0x3b7a6e(0x182)] ?? _0x1516a4,
						_0x4ad7c1 = _0x36855b?.[_0x3b7a6e(0x1ac)] ?? _0x4124c9,
						_0x1f29ad = _0x36855b?.model ?? _0x29dc29;
					if (!_0x4ad7c1) {
						const _0x3372f8 = validateSession(_0x6c4f42);
						if (!_0x3372f8)
							return new Response(
								JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x1c3) }),
								{
									status: 0x191,
									headers: { "Content-Type": _0x3b7a6e(0x19b) },
								},
							);
						const _0x13713e = getUserSettingsByUserId(
							_0x3372f8[_0x3b7a6e(0x1a4)],
						);
						if (!_0x13713e?.api_key)
							return new Response(
								JSON[_0x3b7a6e(0x167)]({ error: _0x3b7a6e(0x183) }),
								{
									status: 0x190,
									headers: { "Content-Type": "application/json" },
								},
							);
						const _0x19a39d = saveSettingsByToken(
							_0x6c4f42,
							_0x399ceb,
							_0x13713e[_0x3b7a6e(0x186)],
							_0x1f29ad,
						);
						if (_0x19a39d[_0x3b7a6e(0x1ad)])
							return new Response(
								JSON.stringify({
									success: !![],
									message: "URL\x20and\x20model\x20updated",
								}),
								{ status: 0xc8, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
							);
						return new Response(
							JSON[_0x3b7a6e(0x167)]({ error: _0x19a39d[_0x3b7a6e(0x1b6)] }),
							{ status: 0x190, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					}
					const _0x296dcf = saveSettingsByToken(
						_0x6c4f42,
						_0x399ceb,
						_0x4ad7c1,
						_0x1f29ad,
					);
					if (_0x296dcf[_0x3b7a6e(0x1ad)])
						return new Response(JSON[_0x3b7a6e(0x167)]({ success: !![] }), {
							status: 0xc8,
							headers: { "Content-Type": "application/json" },
						});
					return new Response(
						JSON[_0x3b7a6e(0x167)]({ error: _0x296dcf[_0x3b7a6e(0x1b6)] }),
						{ status: 0x190, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
					);
				}
				if (
					_0x17511a[_0x3b7a6e(0x1c1)] === _0x3b7a6e(0x17c) &&
					_0x42ba73[_0x3b7a6e(0x185)] === "POST"
				) {
					const _0x38840d = _0x42ba73[_0x3b7a6e(0x165)][_0x3b7a6e(0x1b9)](
							_0x3b7a6e(0x16a),
						),
						_0x458550 = _0x38840d?.replace("Bearer\x20", "");
					return (
						_0x458550 && deleteSession(_0x458550),
						new Response(JSON[_0x3b7a6e(0x167)]({ success: !![] }), {
							status: 0xc8,
							headers: { "Content-Type": _0x3b7a6e(0x19b) },
						})
					);
				}
				if (_0x17511a[_0x3b7a6e(0x1c1)] === `/${SUB_PATH}${_0x3b7a6e(0x18b)}`) {
					const _0x671105 = {
						UUID: UUID,
						DOMAIN: DOMAIN,
						WSPATH: WSPATH,
						SUB_PATH: SUB_PATH,
						NAME: NAME,
						PORT: PORT,
					};
					return new Response(JSON[_0x3b7a6e(0x167)](_0x671105), {
						status: 0xc8,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (_0x17511a[_0x3b7a6e(0x1c1)] === _0x3b7a6e(0x1a0)) {
					if (_0x42ba73[_0x3b7a6e(0x185)] === _0x3b7a6e(0x1b0)) {
						const _0x1eb24e = {
							apiUrl: AI_API_URL,
							model: AI_MODEL,
							hasApiKey: !!AI_API_KEY,
						};
						return new Response(JSON[_0x3b7a6e(0x167)](_0x1eb24e), {
							status: 0xc8,
							headers: { "Content-Type": _0x3b7a6e(0x19b) },
						});
					}
					if (_0x42ba73[_0x3b7a6e(0x185)] === "POST") {
						const _0x308cbb = await _0x42ba73.json(),
							{
								settings: _0x268d96,
								apiUrl: _0x23835a,
								apiKey: _0x23f9e1,
								model: _0x719455,
							} = _0x308cbb;
						if (!_0x268d96 && (!_0x23835a || !_0x23f9e1))
							return new Response(JSON.stringify({ error: _0x3b7a6e(0x196) }), {
								status: 0x190,
								headers: { "Content-Type": _0x3b7a6e(0x19b) },
							});
						const _0x478e9d = _0x268d96 || {
							apiUrl: _0x23835a,
							apiKey: _0x23f9e1,
							model: _0x719455,
						};
						return new Response(
							JSON[_0x3b7a6e(0x167)]({
								success: !![],
								message: _0x3b7a6e(0x192),
								settings: { ..._0x478e9d, apiKey: undefined },
							}),
							{ status: 0xc8, headers: { "Content-Type": _0x3b7a6e(0x19b) } },
						);
					}
				}
				if (_0x17511a.pathname === `/${SUB_PATH}`)
					return new Response(getSub(), {
						status: 0xc8,
						headers: {
							"Content-Type": _0x3b7a6e(0x176),
							"Cache-Control": _0x3b7a6e(0x166),
						},
					});
				if (_0x17511a[_0x3b7a6e(0x1c1)] === `/${WSPATH}`) {
					const _0x253485 = _0x22016d[_0x3b7a6e(0x1be)](_0x42ba73, {
						data: { socket: null },
					});
					return _0x253485
						? undefined
						: new Response("WebSocket\x20upgrade\x20failed", { status: 0x190 });
				}
				const _0x3abb4c =
						_0x17511a[_0x3b7a6e(0x1c1)] === "/"
							? _0x3b7a6e(0x177)
							: _0x17511a[_0x3b7a6e(0x1c1)],
					_0x5babf1 = join(STATIC_DIR, _0x3abb4c),
					_0x251e3e = Bun[_0x3b7a6e(0x1a9)](_0x5babf1);
				if (await _0x251e3e[_0x3b7a6e(0x184)]())
					return new Response(_0x251e3e, {
						headers: {
							"Content-Type": _0x251e3e.type || _0x3b7a6e(0x1c7),
							"Cache-Control": _0x3b7a6e(0x19a),
							"Access-Control-Allow-Origin": "*",
						},
					});
				if (_0x3abb4c[_0x3b7a6e(0x1aa)]("-json"))
					return new Response(
						JSON[_0x3b7a6e(0x167)]({
							error: _0x3b7a6e(0x198),
							message: _0x3b7a6e(0x1a1) + _0x17511a[_0x3b7a6e(0x1c1)],
						}),
						{ status: 0x194, headers: { "Content-Type": "application/json" } },
					);
				if (_0x3abb4c[_0x3b7a6e(0x1a8)](".") || _0x3abb4c === "/")
					return new Response(_0x3b7a6e(0x15e), {
						status: 0x194,
						headers: { "Content-Type": _0x3b7a6e(0x1c7) },
					});
				const _0x3faf09 = Bun[_0x3b7a6e(0x1a9)](STATIC_DIR + _0x3b7a6e(0x177));
				if (await _0x3faf09[_0x3b7a6e(0x184)]())
					return new Response(_0x3faf09, {
						headers: { "Content-Type": _0x3b7a6e(0x1b8) },
					});
				return new Response(_0x3b7a6e(0x15e), { status: 0x194 });
			} catch (_0x53b6b0) {
				return (
					console.error(_0x3b7a6e(0x16f) + _0x53b6b0[_0x3b7a6e(0x1bd)]),
					new Response(_0x3b7a6e(0x17f), {
						status: 0x1f4,
						headers: { "Content-Type": "text/plain;\x20charset=utf-8" },
					})
				);
			}
		},
		websocket: {
			open(_0x434a87) {
				const _0x5dc1a1 = a0_0x36bc41;
				(!_0x434a87[_0x5dc1a1(0x18e)] ||
					typeof _0x434a87[_0x5dc1a1(0x18e)][_0x5dc1a1(0x162)] ===
						_0x5dc1a1(0x194)) &&
					(_0x434a87[_0x5dc1a1(0x18e)] = { socket: null });
			},
			async message(_0x5344f3, _0x2df6d0) {
				const _0x69cb53 = a0_0x36bc41;
				if (_0x5344f3.data[_0x69cb53(0x162)]) {
					try {
						_0x5344f3[_0x69cb53(0x18e)][_0x69cb53(0x162)][_0x69cb53(0x1bf)](
							Buffer.from(_0x2df6d0),
						);
					} catch (_0x1121e4) {
						_0x5344f3[_0x69cb53(0x1a2)]();
					}
					return;
				}
				if (
					handleVlessConnection(_0x5344f3, Buffer[_0x69cb53(0x1c5)](_0x2df6d0))
				)
					return;
				if (
					await handleTrojanConnection(
						_0x5344f3,
						Buffer[_0x69cb53(0x1c5)](_0x2df6d0),
					)
				)
					return;
				_0x5344f3[_0x69cb53(0x1a2)]();
			},
			close(_0x17ff9b) {
				const _0x2e5d59 = a0_0x36bc41;
				_0x17ff9b[_0x2e5d59(0x18e)][_0x2e5d59(0x162)] &&
					_0x17ff9b[_0x2e5d59(0x18e)][_0x2e5d59(0x162)][_0x2e5d59(0x1b4)]();
			},
		},
	});
