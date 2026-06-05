import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { agentStop } from '../../utils/agent.ts';

export const data = new SlashCommandBuilder()
  .setName('agent-stop')
  .setDescription('停止指定的 coding agent 任務')
  .addIntegerOption(opt =>
    opt
      .setName('task-id')
      .setDescription('要停止的 agent task id')
      .setMinValue(1)
      .setRequired(true),
  )
  .addStringOption(opt =>
    opt
      .setName('reason')
      .setDescription('停止原因（選填）')
      .setMaxLength(200),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const taskId = interaction.options.getInteger('task-id', true);
  const reason = interaction.options.getString('reason') ?? `stopped by ${interaction.user.tag}`;

  try {
    await agentStop(taskId, reason);
    await interaction.reply({ content: `已送出停止 task #${taskId} 的請求。`, ephemeral: true });
  } catch (err) {
    console.error('[agent-stop] failed:', err);
    await interaction.reply({ content: '無法連線 Agent 服務，請稍後再試。', ephemeral: true });
  }
}
