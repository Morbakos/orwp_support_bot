import { Channel, Message, TextChannel } from "discord.js";
import { Database } from "./database";
import { generateEmbedSupportMessage, newChannel } from "./functions";

export async function restartSupport(channel: Channel) {
  const db = Database.getInstance();
  await db.execQueryWithParams(
    "DELETE FROM channel WHERE channelUniqueId = ?",
    [channel.id]
  );
  newChannel(channel);
}

export async function closeSupport(message: Message) {
  const db = Database.getInstance();
  const channel = message.channel as TextChannel;

  await db.execQueryWithParams(
    "UPDATE channel SET actif = 0 WHERE channelUniqueId = ?",
    [channel.id]
  );
  channel.permissionOverwrites
    .filter((o) => o.type === "member")
    .map((o) => o.delete());
  const embed = generateEmbedSupportMessage(
    "Ticket clos",
    `Clôture du ticket par ${message.author.toString()}`
  );
  channel.send({ embed });
}

export async function deleteSupport(channel: TextChannel) {
  const db = Database.getInstance();
  await db.execQueryWithParams(
    "UPDATE channel SET actif = 0 WHERE channelUniqueId = ?",
    [channel.id]
  );
  const log_channel = channel.guild.channels.cache.find(
    (c) => c.name === "logs_bot"
  ) as TextChannel;
  await log_channel.send(
    `Suppression du channel ${channel.name} par ${channel.lastMessage.author.username}`
  );
  channel.delete("Support terminé");
}
