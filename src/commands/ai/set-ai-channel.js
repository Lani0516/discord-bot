import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { setServerConfig } from '../../database.js';

export const data = new SlashCommandBuilder()
  .setName('set-ai-channel')
  .setDescription('設定 AI 自動回覆的頻道')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('AI 自動回覆頻道（不選則關閉）')
      .addChannelTypes(ChannelType.GuildText))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel');

  if (channel) {
    setServerConfig(interaction.guild.id, 'ai_channel_id', channel.id);
    await interaction.reply({ content: `✅ AI 自動回覆頻道已設定為 ${channel}`, ephemeral: true });
  } else {
    setServerConfig(interaction.guild.id, 'ai_channel_id', '');
    await interaction.reply({ content: '✅ 已關閉 AI 自動回覆功能。', ephemeral: true });
  }
}
