import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { clearHistory } from '../../utils/gemini.ts';

export const data = new SlashCommandBuilder()
  .setName('clear-history')
  .setDescription('清除你的 AI 對話紀錄');

export async function execute(interaction: ChatInputCommandInteraction) {
  clearHistory(interaction.user.id, interaction.guild!.id);
  await interaction.reply({ content: '你的 AI 對話紀錄已全部清除，下次對話將從頭開始。', ephemeral: true });
}
