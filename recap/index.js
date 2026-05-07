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

    const since = lastMonday.getTime();
    const weekDate = lastMonday.toISOString().split("T")[0]; // YYYY-MM-DD
    const year = lastMonday.getFullYear().toString();

    console.log(`Fetching messages since ${lastMonday.toISOString()}`);

    const messages = [];
    let lastId;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const fetched = await channel.messages.fetch(options);
      if (fetched.size === 0) break;
      const recent = fetched.filter((msg) => msg.createdTimestamp >= since);
      messages.push(...recent.values());
      if (recent.size < fetched.size) break;
      lastId = fetched.last().id;
    }

    console.log(`Fetched ${messages.length} messages`);

    const counts = {};
    let irrelevantMessages = 0;
    messages.forEach((msg) => {
      if (!msg.embeds || msg.embeds.length === 0) return;
      const embed = msg.embeds[0];

      if (embed.title) {
        const titleLower = embed.title.toLowerCase();
        if (
          titleLower.startsWith("message wall greeting:") ||
          titleLower.startsWith("user:") ||
          /^[^:]*talk:/i.test(embed.title)
        ) {
          irrelevantMessages++;
        }
      }

      let name = embed.author?.name;
      if (!name) {
        let text = embed.title || embed.description?.split("\n")[0]?.trim();
        if (text) {
          const parts = text.split(" ");
          name = parts[0];
          if (!/^[a-zA-Z]/.test(name)) {
            name = parts[1] || name;
          }
        }
      }
      if (name) {
        counts[name] = (counts[name] || 0) + 1;
      }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const recap = {
      week: weekDate,
      totalMessages: messages.length,
      irrelevantMessages,
      counts: Object.fromEntries(sorted),
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
      .map(
        ([name, count], i) =>
          `${i + 1}. [${name}](https://${FANDOM_SUBDOMAIN}.fandom.com/User:${name.replace(/ /g, "_")}) - ${count} edit${count === 1 ? "" : "s"}`,
      )
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
