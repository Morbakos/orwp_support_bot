import { Client, MessageReaction, TextChannel, User } from "discord.js";
import * as dotenv from "dotenv";
import { analyzeMessage, analyzeReaction, createChannel } from "./functions";
dotenv.config();

const client = new Client();
client.login(process.env.BOT_TOKEN);

// Constantes
let supportMessageId = "";
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;

client.on("ready", async function () {
  console.log(`Connecté en tant que ${client.user.tag}`);
  client.user.setActivity("les mecs de l'Est", { type: "WATCHING" });
  const channel = client.channels.cache.get(supportChannelId) as TextChannel;
  await clearSupportMessage(channel);
  await getTicketsList();
});

client.on("messageReactionAdd", async function (messageReaction: MessageReaction, user: User) {
  if (user.bot) {
    return;
  }

  if (messageReaction.message.id === supportMessageId) {
    messageReaction.users.remove(user);
    await createChannel(user, messageReaction.message.guild);
  } else {
    await analyzeReaction(messageReaction);
  }
});

client.on("message", async function (message) {
  if (message.author.bot) {
    return;
  }
  if (message.author.username === "Morbakos" && message.content.toLowerCase().startsWith("!say")) {
    const content = message.content.split(" ").slice(1).join(" ");
    await message.channel.send(content);
    return;
  }

  analyzeMessage(message);
});

/**
 * Clear support message
 */
async function clearSupportMessage(channel: TextChannel) {
  const chan = (await channel.fetch()) as TextChannel;
  const msgManager = await chan.messages.fetch();

  if (msgManager.size > 1) {
    for (const [, msg] of msgManager) {
      msg.delete();
    }

    const message = await channel.send(
      `**Besoin d'aide ?**\nRéagissez avec :white_check_mark: à ce message, on va s'occuper de vous !`
    );
    supportMessageId = message.id;
    await message.react("✅");
  } else {
    supportMessageId = msgManager.first().id;
  }
  console.log(`Loaded channel ${chan.name}`);
}

async function getTicketsList() {
  const channels = client.guilds.cache
    .get(process.env.SERVER_ID)
    .channels.cache.filter(
      (c) => c.parentID === process.env.SUPPORT_CATEGORY_ID && c.name.startsWith("support-") && !c.name.includes("humain")
    );
  for (const [, c] of channels) {
    await (c as TextChannel).messages.fetch();
    console.log(`Old messages loaded for channel ${c.name}`);
  }
}

client.on("error", (e) => console.table(e));
client.on("warn", (e) => console.table(e));
client.on("debug", (e) => console.table(e));
