import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction } from 'discord.js';
import { setServerConfig } from '../../database.ts';

export const data = new SlashCommandBuilder()
  .setName('set-agent-channel')
  .setDescription('設定 coding agent 的對話頻道')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('agent 對話頻道（不選則關閉）')
      .addChannelTypes(ChannelType.GuildText))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel');

  if (channel) {
    setServerConfig(interaction.guild!.id, 'agent_channel_id', channel.id);
    await interaction.reply({ content: `Agent 對話頻道已設定為 ${channel}，在該頻道發送訊息即可與 coding agent 互動。`, ephemeral: true });
  } else {
    setServerConfig(interaction.guild!.id, 'agent_channel_id', '');
    await interaction.reply({ content: 'Agent 對話頻道已關閉。', ephemeral: true });
  }
}
