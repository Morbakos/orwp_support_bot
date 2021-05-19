import { Channel, Guild, Message, MessageEmbed, MessageReaction, TextChannel, User } from "discord.js";
import { closeSupport, deleteSupport, restartSupport } from "./admin";
import { Database } from "./database";

const orgaRoleId = "830398261667692544";
const supportCategoryId = '830523077540446218';

const convertNumberToEmoji = {
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
    4: "4️⃣",
    5: "5️⃣",
    6: "6️⃣",
    7: "7️⃣",
    8: "8️⃣",
    9: "9️⃣"
}

const convertEmojiToNumber = {
     "1️⃣": 1,
     "2️⃣": 2,
     "3️⃣": 3,
     "4️⃣": 4,
     "5️⃣": 5,
     "6️⃣": 6,
     "7️⃣": 7,
     "8️⃣": 8,
     "9️⃣": 9
}

/**
 * 
 * @param {Discord.MessageReaction} messageReaction 
 */
export async function analyzeReaction(messageReaction) {
    let isSupportChannel = await checkChannel(messageReaction.message.channel);
    if (!isSupportChannel) {return;} // Leave if not support channel
    nextSupportStep(messageReaction);
}

/**
 * 
 * @param {Discord.Message} message 
 * @returns 
 */
export function analyzeMessage(message: Message) {
    if (
        message.content.toLocaleLowerCase().startsWith('!admin') &&
        message.member.roles.cache.some(r => r.id === orgaRoleId)
    ) {
        let splittedMessage = message.content.split(' ');
        let command = splittedMessage[1];

        switch (command) {

            case 'restart':
                restartSupport(message.channel);
                break;

            case 'close':
                closeSupport(message);
                break;

            case 'delete':
                deleteSupport(message.channel as TextChannel);
                break;

            default:
                break;
        }
    }
}

/**
 * Create new support channel
 * @param {Discord.User} user 
 * @param {Discord.Guild} guild 
 */
export function createChannel(user: User, guild: Guild) {
    let channelName = `support-${user.username}`;
    guild.channels.create(channelName, {
        reason: `Channel de support pour ${user.username}`,
        parent: supportCategoryId
    }).then(channel => {
        channel.createOverwrite(user, {
            'VIEW_CHANNEL': true,
            'SEND_MESSAGES': true,
            'ATTACH_FILES': true
        });

        channel.createOverwrite(guild.roles.cache.find(r => r.name === "@everyone"), {
            'VIEW_CHANNEL': false
        });

        channel.send(`Bonjour ${user.toString()} ! Nous allons t'aider à résoudre ton problème dans les meilleurs délais :smile:.\nAfin de nous permettre d'être le plus efficace, nous t'invitons à suivre les instructions du bot et à réagir dès que c'est fait. Si le bot n'est pas en mesure de t'apporter une solution, n'hésites pas à ping les organisateurs.`);
        newChannel(channel);
    });
}

/**
 * 
 * @param {Channel} channel 
 * @returns bool
 */
export async function checkChannel(channel:Channel) {
    let db = new Database()
    const result = await db.execQueryWithParams('SELECT 1 FROM channel WHERE channelUniqueId = ?', [channel.id]);
    
    if(result[0] === undefined) {
        // This is not a support channel
        return false;
    } else {
        return true;
    };
};

/**
 * 
 * @param {Discord.Channel} channel 
 */
export async function newChannel(channel:Channel) {
    let channelId = channel.id;
    let db = new Database();
    db.execQueryWithParams("INSERT INTO channel(channelUniqueId) VALUES (?)", [channelId]);
    generateEmbedCategoryPicker(channel as TextChannel);
}

/**
 * 
 * @param {Discord.MessageReaction} reaction 
 */
export async function nextSupportStep(reaction: MessageReaction) {

    let message = reaction.message;
    let channel = message.channel as TextChannel;
    let channelId = message.channel.id;
    let db = new Database();
    let supportStep = await db.execQueryWithParams('SELECT idEtape, idCategorie, reactionMessage, actif FROM channel WHERE channelUniqueId = ?', [channelId]);

    if (supportStep[0].actif != true) {
        channel.send("Ce ticket n'est plus actif.");
        return;
    }

    if (supportStep[0].reactionMessage === null && supportStep[0].idEtape === null && supportStep[0].idCategorie === null) { // Premier message: définir une catégorie
        generateEmbedCategoryPicker(channel);
    } else if(supportStep[0].reactionMessage != null && message.id === supportStep[0].reactionMessage && (supportStep[0].idEtape === null && supportStep[0].idCategorie === null)) { 
        // Réaction au message de catégorie
        let catName = await db.execQueryWithParams('SELECT nomCategorie FROM categorie WHERE idCategorie = ?', [convertEmojiToNumber[reaction.emoji.name]]);
        let embed = generateEmbedSupportMessage('Catégorie choisie', `Vous avez choisie la catégorie \`${catName[0].nomCategorie}\`.`);
        message.channel.send({embed: embed});
        
        updateEtape(channelId, 1);
        updateCategorie(channelId, convertEmojiToNumber[reaction.emoji.name]);
        nextSupportStep(reaction);
    } else {
        let instruction = await db.execQueryWithParams('SELECT numeroEtape, titre, instruction FROM etape WHERE numeroEtape = ? AND idCategorie = ?', [supportStep[0].idEtape, supportStep[0].idCategorie]);
        
        if (!instruction[0]) {
            db.execQueryWithParams('UPDATE channel SET actif = 0 WHERE channelUniqueId = ?', [channel.id]);
            pingOrga(message.channel);
            return;
        }

        let embed = generateEmbedSupportMessage(instruction[0].titre, instruction[0].instruction);
        let msg = await message.channel.send({embed: embed});
        msg.react('✅');

        updateReactionMessage(channelId, msg.id);
        updateEtape(channelId, (supportStep[0].idEtape + 1));
    }
}

/**
 * 
 * @param {Discord.Channel} channel 
 */
export function pingOrga (channel: Channel) {
    (channel as TextChannel).send(`J'ai fini <@&${orgaRoleId}>`);
}

/**
 * 
 * @param {Discord.Channel} channel 
 */
export async function generateEmbedCategoryPicker (channel: TextChannel) {
    
    let db = new Database();
    let categories = await db.execQuery('SELECT nomCategorie FROM categorie');

    let embedMessage = new MessageEmbed();
    embedMessage.setTitle('Message de support');
    embedMessage.setColor([235, 64, 52]);
    
    let currentNumber = 1;

    categories.forEach(element => {
        embedMessage.addField(element.nomCategorie, `Réagissez avec ${convertNumberToEmoji[currentNumber]}`);
        currentNumber ++;
    });

    let reactionMessage = await channel.send({embed: embedMessage});

    currentNumber = 1;
    categories.forEach(element => {
        reactionMessage.react(convertNumberToEmoji[currentNumber]);
        currentNumber ++;
    });

    updateReactionMessage(channel.id, reactionMessage.id);
}

/**
 * 
 * @param {string} channelUniqueId 
 * @param {string} messageId 
 */
export function updateReactionMessage (channelUniqueId: string, messageId: string) {
    let db = new Database();
    db.execQueryWithParams('UPDATE channel SET reactionMessage = ? WHERE channelUniqueId = ?', [messageId, channelUniqueId]);
}

/**
 * 
 * @param {string} channelUniqueId 
 * @param {number} categorieId 
 */
export function updateCategorie (channelUniqueId: string, categorieId: number) {
    let db = new Database();
    db.execQueryWithParams('UPDATE channel SET idCategorie = ? WHERE channelUniqueId = ?', [categorieId, channelUniqueId]);
}

/**
 * 
 * @param {string} channelUniqueId 
 * @param {number} etapeId 
 */
export function updateEtape (channelUniqueId: string, etapeId: number) {
    let db = new Database();
    db.execQueryWithParams('UPDATE channel SET idEtape = ? WHERE channelUniqueId = ?', [etapeId, channelUniqueId]);
}

/**
 * 
 * @param {string} titre 
 * @param {string} instruction 
 * @returns embedMessage to send
 */
export function generateEmbedSupportMessage (titre: string, instruction: string) {
    let embedMessage = new MessageEmbed();
    embedMessage.setTitle('Message de support');
    embedMessage.setColor([235, 64, 52]);
    embedMessage.addField(titre, instruction);
    return embedMessage;
}