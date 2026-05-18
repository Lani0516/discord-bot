import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction } from 'discord.js';
import { setServerConfig } from '../../database.ts';

export const data = new SlashCommandBuilder()
  .setName('set-ai-channel')
  .setDescription('設定 AI 自動回覆的頻道')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('AI 自動回覆頻道（不選則關閉）')
      .addChannelTypes(ChannelType.GuildText))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel');

  if (channel) {
    setServerConfig(interaction.guild!.id, 'ai_channel_id', channel.id);
    await interaction.reply({ content: `AI 自動回覆頻道已成功設定為 ${channel}，在該頻道發送訊息即可與 AI 對話。`, ephemeral: true });
  } else {
    setServerConfig(interaction.guild!.id, 'ai_channel_id', '');
    await interaction.reply({ content: 'AI 自動回覆功能已關閉，AI 將不再自動回應訊息。', ephemeral: true });
  }
}
