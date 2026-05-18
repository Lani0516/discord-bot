import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('踢出成員')
  .addUserOption(opt => opt.setName('user').setDescription('要踢出的成員').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('原因'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getMember('user') as GuildMember | null;
  const reason = interaction.options.getString('reason') || '未提供原因';

  if (!target) {
    return interaction.reply({ content: '找不到該成員，對方可能已經離開伺服器。', ephemeral: true });
  }
  if (target.id === interaction.user.id) {
    return interaction.reply({ content: '你不能對自己執行踢出操作。', ephemeral: true });
  }
  if (!target.kickable) {
    return interaction.reply({ content: '我的權限不足以踢出此成員，對方的身分組可能高於我。', ephemeral: true });
  }

  await target.kick(reason);

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('【踢出通知】成員已被移出伺服器')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
      { name: '原因', value: reason },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
