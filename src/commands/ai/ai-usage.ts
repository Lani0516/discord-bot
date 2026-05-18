import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getMonthlyAiUsage, getMonthlyUserAiUsage } from '../../database.ts';

const DEFAULT_MONTHLY_BUDGET_USD = 10;

export const data = new SlashCommandBuilder()
  .setName('ai-usage')
  .setDescription('查看本月 AI API 用量與預估額度')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('只查看指定使用者的用量')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function getMonthStartUnix(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

function getMonthlyBudgetUsd(): number {
  const configured = Number.parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '');
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MONTHLY_BUDGET_USD;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const user = interaction.options.getUser('user');
  const monthStartUnix = getMonthStartUnix();
  const budgetUsd = getMonthlyBudgetUsd();
  const usage = user
    ? getMonthlyUserAiUsage(guildId, user.id, monthStartUnix)
    : getMonthlyAiUsage(guildId, monthStartUnix);

  const usedPercent = budgetUsd > 0 ? (usage.estimatedCostUsd / budgetUsd) * 100 : 0;
  const remainingUsd = Math.max(budgetUsd - usage.estimatedCostUsd, 0);
  const progressBlocks = Math.min(Math.floor(usedPercent / 10), 10);
  const progressBar = `${'█'.repeat(progressBlocks)}${'░'.repeat(10 - progressBlocks)} ${usedPercent.toFixed(1)}%`;

  const embed = new EmbedBuilder()
    .setColor(usedPercent >= 90 ? 0xed4245 : usedPercent >= 70 ? 0xfee75c : 0x57f287)
    .setTitle(user ? `${user.displayName} 的 AI 用量` : '本月 AI 用量 Dashboard')
    .setDescription(progressBar)
    .addFields(
      { name: '本月請求', value: `${formatNumber(usage.requests)} 次`, inline: true },
      { name: '預估花費', value: formatUsd(usage.estimatedCostUsd), inline: true },
      { name: '剩餘額度', value: formatUsd(remainingUsd), inline: true },
      { name: 'Input tokens', value: formatNumber(usage.promptTokens), inline: true },
      { name: 'Output tokens', value: formatNumber(usage.completionTokens), inline: true },
      { name: 'Total tokens', value: formatNumber(usage.totalTokens), inline: true },
    )
    .setFooter({ text: `月預算 ${formatUsd(budgetUsd)}，費用為本地估算，實際金額以 Google Billing 為準。` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
