import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('擲硬幣');

export async function execute(interaction: ChatInputCommandInteraction) {
  const isHeads = Math.random() < 0.5;

  const embed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle('擲硬幣結果')
    .setDescription(isHeads ? '**正面！**' : '**反面！**');

  await interaction.reply({ embeds: [embed] });
}
