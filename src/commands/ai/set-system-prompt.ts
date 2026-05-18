import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { setServerConfig } from '../../database.ts';

export const data = new SlashCommandBuilder()
  .setName('set-system-prompt')
  .setDescription('設定 AI 的系統提示（個性）')
  .addStringOption(opt =>
    opt.setName('prompt')
      .setDescription('系統提示內容')
      .setMaxLength(1000)
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const prompt = interaction.options.getString('prompt')!;
  setServerConfig(interaction.guild!.id, 'system_prompt', prompt);
  await interaction.reply({ content: 'AI 系統提示已成功更新，新的設定會在下一次對話時生效。', ephemeral: true });
}
