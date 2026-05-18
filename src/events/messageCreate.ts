import { Events, Message, TextChannel } from 'discord.js';
import { getAiResponse, isOnCooldown, setCooldown } from '../utils/gemini.ts';
import { getServerConfig } from '../database.ts';

export const name = Events.MessageCreate;

export async function execute(message: Message) {
  if (message.author.bot || !message.guild) return;

  const isMentioned = message.mentions.has(message.client.user!);
  const aiChannelId = getServerConfig(message.guild.id, 'ai_channel_id');
  const isAiChannel = aiChannelId && aiChannelId === message.channel.id;

  if (!isMentioned && !isAiChannel) return;

  const content = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!content) return;

  if (isOnCooldown(message.author.id)) {
    const reply = await message.reply({
      content: '你的訊息傳送得太快了，請稍等幾秒再試一次。',
      allowedMentions: { repliedUser: false },
    });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return;
  }

  setCooldown(message.author.id);
  const channel = message.channel as TextChannel;
  await channel.sendTyping();

  const userContext = {
    displayName: message.member!.displayName,
    roles: message.member!.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => r.name)
      .join(', ') || '無',
    textChannel: channel.name,
    voiceChannel: message.member!.voice?.channel?.name || null,
    guildEmojis: message.guild.emojis.cache
      .filter(emoji => emoji.available)
      .first(20)
      .map(emoji => `${emoji.name}=${emoji.animated ? '<a' : '<'}:${emoji.name}:${emoji.id}>`)
      .join(', ') || '無',
  };

  const response = await getAiResponse(
    message.author.id,
    message.guild.id,
    content,
    userContext,
  );

  const chunks = splitMessage(response);
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      await message.reply({
        content: chunks[i],
        allowedMentions: { repliedUser: false },
      });
    } else {
      await channel.send(chunks[i]);
    }
  }
}

function splitMessage(text: string, maxLength: number = 2000): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  while (text.length > 0) {
    chunks.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }
  return chunks;
}
