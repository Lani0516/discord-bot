import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { setMcServer } from '../../database.ts';
import { queryServer, buildStatusEmbed } from '../../utils/minecraft.ts';

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

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const host = interaction.options.getString('host')!;
  const port = interaction.options.getInteger('port') || 25565;
  const channel = interaction.options.getChannel('channel') as TextChannel;
  const refresh = interaction.options.getInteger('refresh') || 5;

  const serverData = await queryServer(host, port);
  const embedData = buildStatusEmbed(serverData);
  const msg = await channel.send(embedData);

  setMcServer(interaction.guild!.id, {
    host,
    port,
    channelId: channel.id,
    messageId: msg.id,
    refreshMinutes: refresh,
  });

  if (!interaction.client.mcIntervals) {
    interaction.client.mcIntervals = new Map();
  }

  const existing = interaction.client.mcIntervals.get(interaction.guild!.id);
  if (existing) clearInterval(existing);

  const interval = setInterval(async () => {
    try {
      const statusData = await queryServer(host, port);
      const newEmbed = buildStatusEmbed(statusData);
      const ch = await interaction.client.channels.fetch(channel.id).catch(() => null) as TextChannel | null;
      if (!ch) return;
      const statusMsg = await ch.messages.fetch(msg.id).catch(() => null);
      if (statusMsg) {
        await statusMsg.edit(newEmbed);
      } else {
        const newMsg = await ch.send(newEmbed);
        const { updateMcMessageId } = await import('../../database.ts');
        updateMcMessageId(interaction.guild!.id, newMsg.id);
      }
    } catch (err) {
      console.error(`MC refresh error for ${host}:`, (err as Error).message);
    }
  }, refresh * 60 * 1000);

  interaction.client.mcIntervals.set(interaction.guild!.id, interval);

  await interaction.editReply(`Minecraft 伺服器監控已成功啟動！狀態資訊將即時顯示在 ${channel}，並且每 ${refresh} 分鐘自動更新一次。`);
}
