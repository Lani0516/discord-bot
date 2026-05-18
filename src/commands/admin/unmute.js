import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('解除成員禁言')
  .addUserOption(opt => opt.setName('user').setDescription('要解除禁言的成員').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const target = interaction.options.getMember('user');

  if (!target) {
    return interaction.reply({ content: '❌ 找不到該成員。', ephemeral: true });
  }
  if (!target.moderatable) {
    return interaction.reply({ content: '❌ 我無法操作此成員（權限不足）。', ephemeral: true });
  }

  await target.timeout(null);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🔊 已解除禁言')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
