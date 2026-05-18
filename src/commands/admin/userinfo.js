import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('顯示使用者資訊')
  .addUserOption(opt => opt.setName('user').setDescription('要查看的使用者'));

export async function execute(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  const roles = member
    ? member.roles.cache
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(r => r.toString())
        .slice(0, 20)
        .join(', ') || '無'
    : '無法取得';

  const embed = new EmbedBuilder()
    .setColor(member?.displayHexColor || 0x5865f2)
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '📛 顯示名稱', value: member?.displayName || user.username, inline: true },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '📅 帳號建立', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '📥 加入伺服器', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '未知', inline: true },
      { name: '🎭 身分組', value: roles },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
