import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const FANDOM_SUBDOMAIN = process.env.FANDOM_SUBDOMAIN || "tds";
const USER_PAGE_BASE =
	process.env.USER_PAGE_BASE ||
	(PROJECT_DIR === "tdsw"
		? "https://tds.wiki/w"
		: `https://${FANDOM_SUBDOMAIN}.fandom.com`);
const EMBED_COLOR = parseInt(
	process.env.EMBED_COLOR?.replace("#", "") || "00ff00",
	16,
);
const PROJECT_DIR = process.env.PROJECT_DIR || "tdsw";

client.once("ready", async () => {
	console.log(`Bum is ready! Running recap for ${PROJECT_DIR}...`);

	try {
		const channel = await client.channels.fetch(CHANNEL_ID);
		if (!channel || channel.type !== 0) {
			console.error("Channel not found or not a text channel");
			process.exit(1);
		}

		const now = new Date();
		const dayOfWeek = now.getDay();
		const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const lastMonday = new Date(now);
		lastMonday.setDate(now.getDate() - daysSinceMonday - 7);
		lastMonday.setHours(0, 0, 0, 0);

		const weekDate = lastMonday.toISOString().split("T")[0]; // YYYY-MM-DD
		const year = lastMonday.getFullYear().toString();

		console.log(`Fetching messages since ${lastMonday.toISOString()}`);

		const CUTOFF = Date.parse("2026-09-12T14:17:00-05:00");

		let since = lastMonday.getTime();
		if (PROJECT_DIR === "tdsw" && weekDate === "2026-09-14") {
			since = CUTOFF;
			console.log(
				`Temp shift: fetching since cutoff ${new Date(CUTOFF).toISOString()} instead of ${lastMonday.toISOString()}`,
			);
		}
		let messages = [];
		let lastId;

		while (true) {
			const options = { limit: 100 };
			if (lastId) options.before = lastId;
			const fetched = await channel.messages.fetch(options);
			if (fetched.size === 0) break;
			const recent = fetched.filter(
				(msg) => msg.createdTimestamp >= since,
			);
			messages.push(...recent.values());
			if (recent.size < fetched.size) break;
			lastId = fetched.last().id;
		}

		console.log(`Fetched ${messages.length} messages`);

		if (PROJECT_DIR === "tdsw" && since < CUTOFF) {
			const before = messages.length;
			messages = messages.filter((msg) => msg.createdTimestamp <= CUTOFF);
			console.log(
				`Applied one-time cutoff ${new Date(CUTOFF).toISOString()}: ${before} -> ${messages.length} messages`,
			);
		}

		const counts = {};
		let globalIrrelevant = 0;
		messages.forEach((msg) => {
			if (!msg.embeds || msg.embeds.length === 0) return;
			const embed = msg.embeds[0];

			if (embed.title) {
				const titleLower = embed.title.toLowerCase();
				if (
					titleLower === "created account" ||
					titleLower === "migrated account"
				) {
					return;
				}
			}

			let isIrrelevant = false;
			if (embed.title) {
				const titleLower = embed.title.toLowerCase();
				if (
					titleLower.startsWith("message wall greeting:") ||
					titleLower.startsWith("user:") ||
					/^[^:]*talk:/i.test(embed.title)
				) {
					isIrrelevant = true;
					globalIrrelevant++;
				}
			}

			let name = embed.author?.name;
			if (!name) {
				let text =
					embed.title || embed.description?.split("\n")[0]?.trim();
				if (text) {
					const parts = text.split(" ");
					name = parts[0];
					if (!/^[a-zA-Z]/.test(name)) {
						name = parts[1] || name;
					}
				}
			}
			if (name) {
				if (!counts[name]) counts[name] = { total: 0, irrelevant: 0 };
				counts[name].total++;
				if (isIrrelevant) counts[name].irrelevant++;
			}
		});

		const sorted = Object.entries(counts).sort(
			(a, b) =>
				b[1].total - b[1].irrelevant - (a[1].total - a[1].irrelevant),
		);

		// Map back to just numbers for the legacy `counts` object
		const legacyCounts = Object.fromEntries(
			sorted.map(([name, stats]) => [name, stats.total]),
		);

		const irrelevantCounts = Object.fromEntries(
			sorted.map(([name, stats]) => [
				name,
				{
					relevant: stats.total - stats.irrelevant,
					change: stats.irrelevant,
				},
			]),
		);

		const top5 = sorted.slice(0, 5);
		const recap = {
			week: weekDate,
			totalMessages: messages.length,
			irrelevantMessages: globalIrrelevant,
			counts: legacyCounts,
			irrelevantCounts,
		};

		const dataDir = `../data/recap/${PROJECT_DIR}/${year}`;
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		await Bun.write(
			`${dataDir}/${weekDate}.json`,
			JSON.stringify(recap, null, 2),
		);

		const rawMessages = messages.map((msg) => ({
			timestamp: msg.createdTimestamp,
			embeds: msg.embeds.map((embed) => ({
				title: embed.title,
				description: embed.description,
				author: embed.author,
				fields: embed.fields,
				color: embed.color,
			})),
		}));

		await Bun.write(
			`${dataDir}/${weekDate}.raw.json`,
			JSON.stringify(rawMessages, null, 2),
		);

		const formatDate = (date) => {
			const d = String(date.getDate()).padStart(2, "0");
			const m = String(date.getMonth() + 1).padStart(2, "0");
			const y = date.getFullYear();
			return `${d}/${m}/${y}`;
		};

		const endDate = new Date(now.getTime() - 86400000);

		let descriptionContent = top5
			.map(([name, stats], i) => {
				const valid = stats.total - stats.irrelevant;
				return `${i + 1}. [${name}](${USER_PAGE_BASE}/User:${name.replace(/ /g, "_")}) - ${valid} (${stats.total}) edit${stats.total === 1 ? "" : "s"}`;
			})
			.join("\n");

		if (PROJECT_DIR === "aew") {
			descriptionContent =
				"🏆 Type `/syncroles` to receive your contributor role!\n" +
				descriptionContent;
		}

		descriptionContent += `\n\n[📊 View full recap](https://companio.alterego.wiki/recap?date=${weekDate}&wiki=${PROJECT_DIR})`;

		const embed = {
			title: "This Week's Top Contributors",
			description: descriptionContent,
			footer: {
				text: `Top 5 contributors from ${formatDate(lastMonday)} to ${formatDate(endDate)}`,
			},
			color: EMBED_COLOR,
		};

		const response = await fetch(WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ embeds: [embed] }),
		});

		if (!response.ok) {
			throw new Error(`Webhook failed: ${response.status}`);
		}

		console.log("Webhook sent and data saved");
	} catch (error) {
		console.error(error);
		process.exit(1);
	}

	client.destroy();
});

client.login(BOT_TOKEN);
