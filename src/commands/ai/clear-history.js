import { SlashCommandBuilder } from 'discord.js';
import { clearHistory } from '../../utils/gemini.js';

export const data = new SlashCommandBuilder()
  .setName('clear-history')
  .setDescription('清除你的 AI 對話紀錄');

export async function execute(interaction) {
  clearHistory(interaction.user.id, interaction.guild.id);
  await interaction.reply({ content: '✅ 已清除你的 AI 對話紀錄。', ephemeral: true });
}
