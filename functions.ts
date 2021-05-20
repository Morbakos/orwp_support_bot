import { Channel, Guild, Message, MessageEmbed, MessageReaction, TextChannel, User } from "discord.js";
import { closeSupport, deleteSupport, restartSupport } from "./admin";
import { Database } from "./database";

const orgaRoleId = process.env.ORGA_ROLE_ID;
const supportCategoryId = process.env.SUPPORT_CATEGORY_ID;

enum Emojis {
  "1️⃣" = 1,
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
}

/**
 *
 * @param {Discord.MessageReaction} messageReaction
 */
export async function analyzeReaction(messageReaction: MessageReaction): Promise<void> {
  const isSupportChannel = await checkChannel(messageReaction.message.channel);
  if (!isSupportChannel) {
    return;
  } // Leave if not support channel
  await nextSupportStep(messageReaction);
}

/**
 *
 * @param {Discord.Message} message
 * @returns
 */
export function analyzeMessage(message: Message): void {
  if (
    message.content.toLocaleLowerCase().startsWith("!admin") &&
    message.member.roles.cache.some((r) => r.id === orgaRoleId)
  ) {
    const splittedMessage = message.content.split(" ");
    const command = splittedMessage[1];

    switch (command) {
      case "restart":
        restartSupport(message.channel);
        break;

      case "close":
        closeSupport(message);
        break;

      case "delete":
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
export async function createChannel(user: User, { channels, roles }: Guild): Promise<void> {
  const pm = await user.send("Le ticket est en cours de création... Je te ping dès que j'ai fini !");

  const channelName = `support-${user.username}`;
  const channel = await channels.create(channelName, {
    reason: `Channel de support pour ${user.username}`,
    parent: supportCategoryId,
  });
  await channel.createOverwrite(
    roles.cache.find((r) => r.name === "@everyone"),
    {
      VIEW_CHANNEL: false,
    }
  );

  await newChannel(channel);

  await generateEmbedCategoryPicker(channel as TextChannel);

  await channel.createOverwrite(user, {
    VIEW_CHANNEL: true,
    SEND_MESSAGES: true,
    ATTACH_FILES: true,
  });

  await channel.send(
    `Bonjour ${user.toString()} ! Nous allons t'aider à résoudre ton problème dans les meilleurs délais :smile:.\nAfin de nous permettre d'être le plus efficace, nous t'invitons à suivre les instructions du bot et à réagir dès que c'est fait. Si le bot n'est pas en mesure de t'apporter une solution, n'hésites pas à ping les organisateurs.`
  );

  await pm.delete();
}

/**
 *
 * @param {Channel} channel
 * @returns bool
 */
export async function checkChannel({ id }: Channel): Promise<boolean> {
  const db = Database.getInstance();
  const result = await db.execQueryWithParams("SELECT 1 FROM channel WHERE channelUniqueId = ?", [id]);

  if (!result[0]) {
    // This is not a support channel
    return false;
  } else {
    return true;
  }
}

/**
 *
 * @param {Discord.Channel} channel
 */
export async function newChannel(channel: Channel): Promise<void> {
  const db = Database.getInstance();
  db.execQueryWithParams("INSERT INTO channel(channelUniqueId) VALUES (?)", [channel.id]);
}

/**
 *
 * @param {Discord.MessageReaction} reaction
 */
export async function nextSupportStep(reaction: MessageReaction): Promise<void> {
  const { message } = reaction;
  const channel = message.channel as TextChannel;
  const { id: channelId } = message.channel;
  const db = Database.getInstance();
  const [supportStep] = await db.execQueryWithParams(
    "SELECT idEtape, idCategorie, reactionMessage, actif FROM channel WHERE channelUniqueId = ?",
    [channelId]
  );

  if (supportStep.actif !== 1) {
    await channel.send("Ce ticket n'est plus actif.");
    return;
  }

  if (
    supportStep.reactionMessage === null &&
    supportStep.idEtape === null &&
    supportStep.idCategorie === null
  ) {
    // Premier message: définir une catégorie
    await generateEmbedCategoryPicker(channel);
  } else if (
    supportStep.reactionMessage !== null &&
    message.id === supportStep.reactionMessage &&
    supportStep.idEtape === null &&
    supportStep.idCategorie === null
  ) {
    // Réaction au message de catégorie
    const [catName] = await db.execQueryWithParams(
      "SELECT nomCategorie FROM categorie WHERE idCategorie = ?",
      [Emojis[reaction.emoji.name]]
    );
    const embed = generateEmbedSupportMessage(
      "Catégorie choisie",
      `Vous avez choisie la catégorie \`${catName.nomCategorie}\`.`
    );
    await message.channel.send({ embed });

    await updateEtape(channelId, 1);
    await updateCategorie(channelId, Emojis[reaction.emoji.name]);
    await nextSupportStep(reaction);
  } else {
    const [instruction] = await db.execQueryWithParams(
      "SELECT numeroEtape, titre, instruction FROM etape WHERE numeroEtape = ? AND idCategorie = ?",
      [supportStep.idEtape, supportStep.idCategorie]
    );

    if (!instruction) {
      await db.execQueryWithParams("UPDATE channel SET actif = 0 WHERE channelUniqueId = ?", [channel.id]);
      await pingOrga(message.channel);
      return;
    }

    const embed = generateEmbedSupportMessage(instruction.titre, instruction.instruction);
    const msg = await message.channel.send({ embed });
    await msg.react("✅");

    await updateReactionMessage(channelId, msg.id);
    await updateEtape(channelId, supportStep.idEtape + 1);
  }
}

/**
 *
 * @param {Discord.Channel} channel
 */
export async function pingOrga(channel: Channel): Promise<void> {
  await (channel as TextChannel).send(`J'ai fini <@&${orgaRoleId}>`);
}

/**
 *
 * @param {Discord.Channel} channel
 */
export async function generateEmbedCategoryPicker(channel: TextChannel): Promise<void> {
  const db = Database.getInstance();
  const categories = await db.execQuery("SELECT nomCategorie FROM categorie");

  const embed = new MessageEmbed();
  embed.setTitle("Message de support");
  embed.setColor([235, 64, 52]);

  for (const [currentNumber, element] of categories.entries()) {
    embed.addField(element.nomCategorie, `Réagissez avec ${Emojis[currentNumber + 1]}`);
  }

  const reactionMessage = await channel.send({ embed });

  for (const [currentNumber] of categories.entries()) {
    await reactionMessage.react(Emojis[currentNumber + 1]);
  }

  await updateReactionMessage(channel.id, reactionMessage.id);
}

/**
 *
 * @param {string} channelUniqueId
 * @param {string} messageId
 */
export async function updateReactionMessage(channelUniqueId: string, messageId: string): Promise<void> {
  const db = Database.getInstance();
  await db.execQueryWithParams("UPDATE channel SET reactionMessage = ? WHERE channelUniqueId = ?", [
    messageId,
    channelUniqueId,
  ]);
}

/**
 *
 * @param {string} channelUniqueId
 * @param {number} categorieId
 */
export async function updateCategorie(channelUniqueId: string, categorieId: number): Promise<void> {
  const db = Database.getInstance();
  await db.execQueryWithParams("UPDATE channel SET idCategorie = ? WHERE channelUniqueId = ?", [
    categorieId,
    channelUniqueId,
  ]);
}

/**
 *
 * @param {string} channelUniqueId
 * @param {number} etapeId
 */
export async function updateEtape(channelUniqueId: string, etapeId: number): Promise<void> {
  const db = Database.getInstance();
  await db.execQueryWithParams("UPDATE channel SET idEtape = ? WHERE channelUniqueId = ?", [
    etapeId,
    channelUniqueId,
  ]);
}

/**
 *
 * @param {string} titre
 * @param {string} instruction
 * @returns embedMessage to send
 */
export function generateEmbedSupportMessage(titre: string, instruction: string): MessageEmbed {
  const embedMessage = new MessageEmbed();
  embedMessage.setTitle("Message de support");
  embedMessage.setColor([235, 64, 52]);
  embedMessage.addField(titre, instruction);
  return embedMessage;
}
