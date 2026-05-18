import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { setMcServer } from '../../database.js';
import { queryServer, buildStatusEmbed } from '../../utils/minecraft.js';

export const data = new SlashCommandBuilder()
  .setName('mc-setup')
  .setDescription('設定 Minecraft 伺服器監控')
  .addStringOption(opt => opt.setName('host').setDescription('伺服器地址').setRequired(true))
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('顯示狀態的頻道')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
  .addIntegerOption(opt => opt.setName('port').setDescription('連接埠（預設 25565）').setMinValue(1).setMaxValue(65535))
  .addIntegerOption(opt => opt.setName('refresh').setDescription('自動更新間隔（分鐘，預設 5）').setMinValue(1).setMaxValue(60))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const host = interaction.options.getString('host');
  const port = interaction.options.getInteger('port') || 25565;
  const channel = interaction.options.getChannel('channel');
  const refresh = interaction.options.getInteger('refresh') || 5;

  const data = await queryServer(host, port);
  const embedData = buildStatusEmbed(data);
  const msg = await channel.send(embedData);

  setMcServer(interaction.guild.id, {
    host,
    port,
    channelId: channel.id,
    messageId: msg.id,
    refreshMinutes: refresh,
  });

  if (!interaction.client.mcIntervals) {
    interaction.client.mcIntervals = new Map();
  }

  const existing = interaction.client.mcIntervals.get(interaction.guild.id);
  if (existing) clearInterval(existing);

  const interval = setInterval(async () => {
    try {
      const serverData = await queryServer(host, port);
      const newEmbed = buildStatusEmbed(serverData);
      const ch = await interaction.client.channels.fetch(channel.id).catch(() => null);
      if (!ch) return;
      const statusMsg = await ch.messages.fetch(msg.id).catch(() => null);
      if (statusMsg) {
        await statusMsg.edit(newEmbed);
      } else {
        const newMsg = await ch.send(newEmbed);
        const { updateMcMessageId } = await import('../../database.js');
        updateMcMessageId(interaction.guild.id, newMsg.id);
      }
    } catch (err) {
      console.error(`MC refresh error for ${host}:`, err.message);
    }
  }, refresh * 60 * 1000);

  interaction.client.mcIntervals.set(interaction.guild.id, interval);

  await interaction.editReply(`✅ Minecraft 伺服器監控已設定！狀態將顯示在 ${channel}，每 ${refresh} 分鐘更新。`);
}
