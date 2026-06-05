import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('pong')
  .setDescription('測試機器人是否在線');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply('Pong');
}
