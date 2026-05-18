import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('踢出成員')
  .addUserOption(opt => opt.setName('user').setDescription('要踢出的成員').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('原因'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason') || '未提供原因';

  if (!target) {
    return interaction.reply({ content: '❌ 找不到該成員。', ephemeral: true });
  }
  if (target.id === interaction.user.id) {
    return interaction.reply({ content: '❌ 你不能踢出自己。', ephemeral: true });
  }
  if (!target.kickable) {
    return interaction.reply({ content: '❌ 我無法踢出此成員（權限不足）。', ephemeral: true });
  }

  await target.kick(reason);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('👢 成員已被踢出')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
      { name: '原因', value: reason },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
