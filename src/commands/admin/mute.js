import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('禁言成員')
  .addUserOption(opt => opt.setName('user').setDescription('要禁言的成員').setRequired(true))
  .addIntegerOption(opt => opt.setName('duration').setDescription('禁言時長（分鐘）').setMinValue(1).setMaxValue(10080).setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('原因'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason') || '未提供原因';

  if (!target) {
    return interaction.reply({ content: '❌ 找不到該成員。', ephemeral: true });
  }
  if (!target.moderatable) {
    return interaction.reply({ content: '❌ 我無法禁言此成員（權限不足）。', ephemeral: true });
  }

  await target.timeout(duration * 60 * 1000, reason);

  const embed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle('🔇 成員已被禁言')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '時長', value: `${duration} 分鐘`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
      { name: '原因', value: reason },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
