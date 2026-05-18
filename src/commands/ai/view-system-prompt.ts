import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getServerConfig } from '../../database.ts';

const DEFAULT_PROMPT = '你是一個友善的 Discord 機器人助手。請用繁體中文回覆。根據使用者的語言自動切換回覆語言。';

export const data = new SlashCommandBuilder()
  .setName('view-system-prompt')
  .setDescription('查看目前的 AI 系統提示');

export async function execute(interaction: ChatInputCommandInteraction) {
  const prompt = getServerConfig(interaction.guild!.id, 'system_prompt') || DEFAULT_PROMPT;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('目前的 AI 系統提示')
    .setDescription(prompt)
    .setFooter({ text: getServerConfig(interaction.guild!.id, 'system_prompt') ? '自訂提示' : '預設提示' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
