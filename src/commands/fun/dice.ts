import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('擲骰子')
  .addIntegerOption(opt => opt.setName('sides').setDescription('骰子面數').setMinValue(2).setMaxValue(100))
  .addIntegerOption(opt => opt.setName('count').setDescription('骰子數量').setMinValue(1).setMaxValue(10));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sides = interaction.options.getInteger('sides') || 6;
  const count = interaction.options.getInteger('count') || 1;

  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = results.reduce((a, b) => a + b, 0);
  const detail = count > 1 ? `${results.join(' + ')} = **${total}**` : `**${total}**`;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`骰子結果 — 擲出 ${count}d${sides}`)
    .setDescription(detail);

  await interaction.reply({ embeds: [embed] });
}
