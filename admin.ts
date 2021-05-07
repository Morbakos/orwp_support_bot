import { Channel, Message, TextChannel } from "discord.js";
import { Database } from "./database";
import { generateEmbedSupportMessage, newChannel } from "./functions";

export async function restartSupport(channel: Channel) {
    let db = new Database();
    await db.execQueryWithParams('DELETE FROM channel WHERE channelUniqueId = ?', [channel.id]);
    newChannel(channel);
}

export async function closeSupport(message:Message) {
    let db = new Database();
    let channel = message.channel as TextChannel;

    await db.execQueryWithParams('UPDATE channel SET actif = 0 WHERE channelUniqueId = ?', [channel.id]);
    channel.permissionOverwrites.filter(o => o.type === 'member').map(o => o.delete());
    let embed = generateEmbedSupportMessage('Ticket clos', `Clôture du ticket par ${message.author.toString()}`);
    channel.send({embed: embed});
}

export async function deleteSupport(channel:TextChannel) {
    let db = new Database();
    await db.execQueryWithParams('UPDATE channel SET actif = 0 WHERE channelUniqueId = ?', [channel.id]);
    let log_channel = channel.guild.channels.cache.find(c => c.name === "logs_bot") as TextChannel;
    await log_channel.send(`Suppression du channel ${channel.name} par ${channel.lastMessage.author.username}`);
    channel.delete("Support terminé");
}