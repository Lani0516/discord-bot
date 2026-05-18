import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('封鎖成員')
  .addUserOption(opt => opt.setName('user').setDescription('要封鎖的成員').setRequired(true))
  .addIntegerOption(opt => opt.setName('delete_days').setDescription('刪除幾天內的訊息').setMinValue(0).setMaxValue(7))
  .addStringOption(opt => opt.setName('reason').setDescription('原因'))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  const target = interaction.options.getMember('user');
  const deleteDays = interaction.options.getInteger('delete_days') || 0;
  const reason = interaction.options.getString('reason') || '未提供原因';

  if (!target) {
    return interaction.reply({ content: '❌ 找不到該成員。', ephemeral: true });
  }
  if (target.id === interaction.user.id) {
    return interaction.reply({ content: '❌ 你不能封鎖自己。', ephemeral: true });
  }
  if (!target.bannable) {
    return interaction.reply({ content: '❌ 我無法封鎖此成員（權限不足）。', ephemeral: true });
  }

  await target.ban({ deleteMessageDays: deleteDays, reason });

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🔨 成員已被封鎖')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
      { name: '原因', value: reason },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
