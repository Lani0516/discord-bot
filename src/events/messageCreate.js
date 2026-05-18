import { Events } from 'discord.js';
import { getAiResponse, isOnCooldown, setCooldown } from '../utils/gemini.js';
import { getServerConfig } from '../database.js';

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot || !message.guild) return;

  const isMentioned = message.mentions.has(message.client.user);
  const aiChannelId = getServerConfig(message.guild.id, 'ai_channel_id');
  const isAiChannel = aiChannelId && aiChannelId === message.channel.id;

  if (!isMentioned && !isAiChannel) return;

  const content = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!content) return;

  if (isOnCooldown(message.author.id)) {
    const reply = await message.reply('⏳ 請稍等幾秒再試。');
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return;
  }

  setCooldown(message.author.id);
  await message.channel.sendTyping();

  const userContext = {
    displayName: message.member.displayName,
    roles: message.member.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => r.name)
      .join(', ') || '無',
    textChannel: message.channel.name,
    voiceChannel: message.member.voice?.channel?.name || null,
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
      await message.reply(chunks[i]);
    } else {
      await message.channel.send(chunks[i]);
    }
  }
}

function splitMessage(text, maxLength = 2000) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  while (text.length > 0) {
    chunks.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }
  return chunks;
}
