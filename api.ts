import { Client, TextChannel } from "discord.js";
import * as dotenv from "dotenv";
import { analyzeMessage, analyzeReaction, createChannel } from "./functions";
dotenv.config();

const client:Client = new Client();
client.login(process.env.BOT_TOKEN);

// Constantes
let supportMessageId = "";
const supportChannelId = '830523124554006538';

client.on('ready', function() {
    console.log(`Connecté en tant que ${client.user.tag}`);
    client.user.setActivity('les mecs de l\'Est', {type: 'WATCHING'});
    let channel = client.channels.cache.get(supportChannelId) as TextChannel;
    clearSupportMessage(channel);
});

client.on('messageReactionAdd', function (messageReaction, user) {
    if (user.bot) {return;}

    if (messageReaction.message.id === supportMessageId) {
        messageReaction.fetch().then(reaction => {
            reaction.remove();
            messageReaction.message.react('✅');
        });
        createChannel(user, messageReaction.message.guild);
    } else {
        analyzeReaction(messageReaction);
    }
});

client.on('message', function (message) {
    if (message.author.bot) {return;}
    if (message.author.username === "Morbakos" && message.content.toLowerCase().startsWith("!say")) {
        let content = message.content.split(' ').slice(1).join(' ');
        message.channel.send(content);
        return;
    }

    analyzeMessage(message);
})

/**
 * Clear support message
 */
function clearSupportMessage(channel: TextChannel) {
    channel.fetch().then((chan: TextChannel) => {
        chan.messages.fetch().then(msgManager => {
            if (msgManager.size > 0) {
                msgManager.forEach(msg => {
                    msg.delete();
                });
            }
        });
    });
    channel.send(`**Besoin d'aide ?**\nRéagissez avec :white_check_mark: à ce message, on va s'occuper de vous !`)
        .then(message => {
            supportMessageId = message.id;
            message.react('✅');
        });
}
