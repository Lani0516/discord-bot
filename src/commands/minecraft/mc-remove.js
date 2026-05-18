import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getMcServer, removeMcServer } from '../../database.js';

export const data = new SlashCommandBuilder()
  .setName('mc-remove')
  .setDescription('移除 Minecraft 伺服器監控')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const config = getMcServer(interaction.guild.id);
  if (!config) {
    return interaction.reply({ content: '❌ 此伺服器尚未設定 Minecraft 監控。', ephemeral: true });
  }

  const interval = interaction.client.mcIntervals?.get(interaction.guild.id);
  if (interval) {
    clearInterval(interval);
    interaction.client.mcIntervals.delete(interaction.guild.id);
  }

  if (config.message_id && config.channel_id) {
    try {
      const channel = await interaction.client.channels.fetch(config.channel_id);
      const msg = await channel.messages.fetch(config.message_id);
      await msg.delete();
    } catch {}
  }

  removeMcServer(interaction.guild.id);
  await interaction.reply({ content: '✅ 已移除 Minecraft 伺服器監控。', ephemeral: true });
}
