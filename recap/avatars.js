import path from "path";
import satori from "satori";
import sharp from "sharp";

const ASSETS = path.join(import.meta.dir, "assets");
const WIDTH = 1100;
const HEIGHT = 260;
const TEXT = "#f8f9fa";
const DARK = "#06101f";
const UA = { "User-Agent": "Mozilla/5.0 (recap-avatars)" };

const read = (file) => Bun.file(path.join(ASSETS, file)).arrayBuffer();
const [medium, extraBold, bgJpg] = await Promise.all([
	read("Montserrat-Medium.ttf"),
	read("Montserrat-ExtraBold.ttf"),
	read("bg.jpg"),
]);
const bgUri = `data:image/jpeg;base64,${Buffer.from(bgJpg).toString("base64")}`;
const fonts = [
	{ name: "Montserrat", data: medium, weight: 500, style: "normal" },
	{ name: "Montserrat", data: extraBold, weight: 800, style: "normal" },
];

const normName = (s) => s.replace(/_/g, " ").trim().toLowerCase();
const isFandom = (base) => new URL(base).hostname.endsWith("fandom.com");

const rgba = (hex, alpha) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const api = (base, file, params) =>
	fetch(`${base}/${file}?${new URLSearchParams({ format: "json", ...params })}`, {
		headers: UA,
		signal: AbortSignal.timeout(10000),
	}).then((res) => res.json());

async function avatarUrls(names, base) {
	const joined = names.join("|");
	if (!isFandom(base)) {
		const data = await api(base, "api.php", {
			action: "query",
			list: "integratedprofileavatar",
			ipauser: joined,
		});
		return (data.query?.integratedprofileavatar ?? []).map((a) => [
			a.user,
			new URL(a.avatar_url, base).href,
		]);
	}
	const users = await api(base, "api.php", {
		action: "query",
		list: "users",
		ususers: joined,
	});
	const ids = (users.query?.users ?? []).map((u) => u.userid).filter(Boolean);
	if (!ids.length) return [];
	const details = await api(base, "wikia.php", {
		controller: "UserApi",
		method: "getDetails",
		ids: ids.join(","),
	});
	return (details.items ?? []).map((i) => [
		i.name,
		i.avatar.replace("/width/100/height/100", "/width/256/height/256"),
	]);
}

async function avatarUri(url) {
	if (!url) return null;
	try {
		const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
		const png = await sharp(await res.arrayBuffer()).resize(256, 256).png().toBuffer();
		return `data:image/png;base64,${png.toString("base64")}`;
	} catch {
		return null;
	}
}

const h = (style, children) => ({
	type: "div",
	props: { style: { display: "flex", ...style }, children },
});

function card({ name, relevant }, rank, src, accent) {
	const first = rank === 1;
	const size = first ? 128 : 104;
	const badge = first ? 38 : 32;
	const avatar = src
		? {
				type: "img",
				props: {
					src,
					width: size,
					height: size,
					style: { width: size, height: size, borderRadius: "50%" },
				},
			}
		: h(
				{
					width: size,
					height: size,
					borderRadius: "50%",
					background: accent,
					alignItems: "center",
					justifyContent: "center",
					color: DARK,
					fontWeight: 800,
					fontSize: Math.round(size * 0.46),
				},
				name[0].toUpperCase(),
			);

	return h({ flexDirection: "column", alignItems: "center", width: 190 }, [
		h(
			{ alignItems: "center", justifyContent: "center", height: 140 },
			h(
				{
					position: "relative",
					width: size,
					height: size,
					borderRadius: "50%",
					border: `${first ? 4 : 3}px solid ${first ? accent : "rgba(255,255,255,0.28)"}`,
					boxShadow: first
						? `0 0 36px ${rgba(accent, 0.55)}`
						: "0 6px 18px rgba(0,0,0,0.45)",
				},
				[
					avatar,
					h(
						{
							position: "absolute",
							right: -6,
							bottom: -6,
							width: badge,
							height: badge,
							borderRadius: "50%",
							background: first ? accent : "#16233a",
							color: first ? DARK : TEXT,
							alignItems: "center",
							justifyContent: "center",
							fontWeight: 800,
							fontSize: first ? 20 : 17,
						},
						String(rank),
					),
				],
			),
		),
		h(
			{ marginTop: 16, fontWeight: 500, fontSize: 22, color: TEXT },
			name.length > 14 ? `${name.slice(0, 13)}…` : name,
		),
		h({ marginTop: 2, fontWeight: 800, fontSize: 28, color: accent }, String(relevant)),
	]);
}

export async function renderTop5(entries, accent, wikiBase) {
	const urls = new Map(
		(await avatarUrls(entries.map((e) => e.name), wikiBase).catch(() => [])).map(
			([name, url]) => [normName(name), url],
		),
	);
	const avatars = await Promise.all(
		entries.map((e) => avatarUri(urls.get(normName(e.name)))),
	);
	const image = !isFandom(wikiBase);

	const tree = h(
		{
			position: "relative",
			width: WIDTH,
			height: HEIGHT,
			fontFamily: "Montserrat",
			backgroundColor: "#070b14",
			backgroundImage: image
				? undefined
				: `radial-gradient(ellipse at 50% 0%, ${rgba(accent, 0.38)} 0%, ${rgba(accent, 0)} 75%)`,
		},
		[
			image && {
				type: "img",
				props: {
					src: bgUri,
					width: WIDTH,
					height: HEIGHT,
					style: { position: "absolute", top: 0, left: 0 },
				},
			},
			h(
				{
					position: "relative",
					alignItems: "center",
					justifyContent: "space-around",
					width: WIDTH,
					height: HEIGHT,
				},
				entries.map((e, i) => card(e, i + 1, avatars[i], accent)),
			),
		].filter(Boolean),
	);

	const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });
	return sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
}
