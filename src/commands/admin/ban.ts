import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('封鎖成員')
  .addUserOption(opt => opt.setName('user').setDescription('要封鎖的成員').setRequired(true))
  .addIntegerOption(opt => opt.setName('delete_days').setDescription('刪除幾天內的訊息').setMinValue(0).setMaxValue(7))
  .addStringOption(opt => opt.setName('reason').setDescription('原因'))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getMember('user') as GuildMember | null;
  const deleteDays = interaction.options.getInteger('delete_days') || 0;
  const reason = interaction.options.getString('reason') || '未提供原因';

  if (!target) {
    return interaction.reply({ content: '找不到該成員，對方可能已經離開伺服器。', ephemeral: true });
  }
  if (target.id === interaction.user.id) {
    return interaction.reply({ content: '你不能對自己執行封鎖操作。', ephemeral: true });
  }
  if (!target.bannable) {
    return interaction.reply({ content: '我的權限不足以封鎖此成員，對方的身分組可能高於我。', ephemeral: true });
  }

  await target.ban({ deleteMessageDays: deleteDays, reason });

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('【封鎖通知】成員已被移除並封鎖')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
      { name: '原因', value: reason },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
