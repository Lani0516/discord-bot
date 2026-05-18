import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('解除成員禁言')
  .addUserOption(opt => opt.setName('user').setDescription('要解除禁言的成員').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getMember('user') as GuildMember | null;

  if (!target) {
    return interaction.reply({ content: '找不到該成員，對方可能已經離開伺服器。', ephemeral: true });
  }
  if (!target.moderatable) {
    return interaction.reply({ content: '我的權限不足以操作此成員，對方的身分組可能高於我。', ephemeral: true });
  }

  await target.timeout(null);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('【解除禁言】成員已恢復發言權限')
    .addFields(
      { name: '成員', value: `${target.user.tag}`, inline: true },
      { name: '執行者', value: `${interaction.user.tag}`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
