import { Channel, Message, TextChannel } from "discord.js";
import { Database } from "./database";
import { generateEmbedSupportMessage, newChannel } from "./functions";

export async function restartSupport(channel: Channel): Promise<void> {
  const db = Database.getInstance();
  await db.execQueryWithParams("DELETE FROM channel WHERE channelUniqueId = ?", [channel.id]);
  await newChannel(channel);
}

export async function closeSupport(message: Message): Promise<void> {
  const db = Database.getInstance();
  const channel = message.channel as TextChannel;

  const [alreadyClosed] = await db.execQueryWithParams(
    "SELECT actif FROM channel WHERE channelUniqueId = ?",
    [channel.id]
  );

  if (!alreadyClosed.actif) {
    const embed = generateEmbedSupportMessage(
      "Action impossible",
      `Ce ticket a déjà été clos.`
    );
    await channel.send({ embed });
    return;
  }

  await db.execQueryWithParams("UPDATE channel SET actif = 0 WHERE channelUniqueId = ?", [
    channel.id,
  ]);
  channel.permissionOverwrites.filter((o) => o.type === "member" && o.allow.has("SEND_MESSAGES")).map(async (o) => await o.update({
    SEND_MESSAGES: false
  }));

  const embed = generateEmbedSupportMessage(
    "Ticket clos",
    `Clôture du ticket par ${message.author.toString()}`
  );
  await channel.send({ embed });
}

export async function openSupport(message: Message): Promise<void> {
  const db = Database.getInstance();
  const channel = message.channel as TextChannel;

  const [alreadyClosed] = await db.execQueryWithParams(
    "SELECT actif FROM channel WHERE channelUniqueId = ?",
    [channel.id]
  );

  if (alreadyClosed.actif) {
    const embed = generateEmbedSupportMessage(
      "Action impossible",
      `Ce ticket est déjà ouvert`
    );
    await channel.send({ embed });
    return;
  }

  await db.execQueryWithParams("UPDATE channel SET actif = 1 WHERE channelUniqueId = ?", [
    channel.id,
  ]);
  channel.permissionOverwrites.filter((o) => o.type === "member" && o.deny.has("SEND_MESSAGES")).map(async (o) => await o.update({
    SEND_MESSAGES: true
  }));

  const embed = generateEmbedSupportMessage(
    "Ticket réouvert",
    `Réouverture du ticket par ${message.author.toString()}`
  );
  await channel.send({ embed });
}

export async function deleteSupport(channel: TextChannel): Promise<void> {
  const db = Database.getInstance();
  await db.execQueryWithParams("UPDATE channel SET actif = 0 WHERE channelUniqueId = ?", [
    channel.id,
  ]);
  const log_channel = channel.guild.channels.cache.find(
    (c) => c.name === "logs_bot"
  ) as TextChannel;
  await log_channel.send(
    `Suppression du channel ${channel.name} par ${channel.lastMessage.author.username}`
  );
  await channel.delete("Support terminé");
}
