import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('顯示伺服器資訊');

export async function execute(interaction: ChatInputCommandInteraction) {
  const { guild } = interaction;
  const owner = await guild!.fetchOwner();

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(guild!.name)
    .setThumbnail(guild!.iconURL({ size: 256 }))
    .addFields(
      { name: '伺服器擁有者', value: owner.user.tag, inline: true },
      { name: '成員總數', value: `${guild!.memberCount}`, inline: true },
      { name: '頻道總數', value: `${guild!.channels.cache.size}`, inline: true },
      { name: '身分組總數', value: `${guild!.roles.cache.size}`, inline: true },
      { name: 'Nitro 加成等級', value: `${guild!.premiumTier} (${guild!.premiumSubscriptionCount} 次加成)`, inline: true },
      { name: '建立日期', value: `<t:${Math.floor(guild!.createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
