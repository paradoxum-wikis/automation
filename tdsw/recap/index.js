import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CHANNEL_ID = "940127956276224020";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;

client.once("ready", async () => {
  console.log("Bum is ready!");

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
    messages.forEach((msg) => {
      if (!msg.embeds || msg.embeds.length === 0) return;
      const embed = msg.embeds[0];
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
    const data = {
      week: lastMonday.toISOString().split("T")[0],
      totalMessages: messages.length,
      counts: Object.fromEntries(sorted),
    };
    const dir = "week";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(`${dir}/${data.week}.json`, JSON.stringify(data, null, 2));

    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const embed = {
      title: "This Week's Top Contributors",
      description: `${top5.map(([name, count], i) => `${i + 1}. [${name}](https://tds.fandom.com/User:${name.replace(/ /g, "_")}) - ${count} edit${count === 1 ? "" : "s"}`).join("\n")}\n\n[📊 View full recap](https://github.com/Paradoxum-Wikis/weekly-contributor-test/blob/main/week/${data.week}.json)`,
      footer: {
        text: `Top 5 contributors from ${formatDate(lastMonday)} to ${formatDate(new Date(now.getTime() - 86400000))}`,
      },
      color: 0x00ff00,
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
  }

  client.destroy();
});

client.login(BOT_TOKEN);
