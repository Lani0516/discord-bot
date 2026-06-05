import { Events, Interaction, TextChannel, PermissionFlagsBits } from 'discord.js';
import { getMcServer } from '../database.ts';
import { agentConfirm, agentModGate, type ConfirmAction, type ModGateKind } from '../utils/agent.ts';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: '無法辨識此指令，該指令可能已被移除或更新。', ephemeral: true });
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const reply = { content: '執行指令時發生了意外錯誤，請稍後重新嘗試。', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const agentMatch = interaction.customId.match(/^agent_(start|cancel)_(\d+)_(\d+)$/);
    if (agentMatch) {
      const action = agentMatch[1] as ConfirmAction;
      const taskId = Number(agentMatch[2]);
      const requesterId = agentMatch[3];

      if (interaction.user.id !== requesterId) {
        await interaction.reply({ content: '只有發話者可確認此計畫。', ephemeral: true });
        return;
      }

      await interaction.deferUpdate();
      try {
        await agentConfirm(taskId, action);
        await interaction.message.edit({ components: [] });
        const channel = interaction.channel as TextChannel | null;
        await channel?.send(action === 'start' ? '已開始動工。' : '已取消此計畫。');
      } catch (error) {
        console.error('Agent confirm button error:', error);
        await interaction.followUp({ content: '無法連線 Agent 服務，請稍後再試。', ephemeral: true });
      }
      return;
    }

    const modGate = parseModGate(interaction.customId);
    if (modGate) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: '需要「管理伺服器」權限才能審批。', ephemeral: true });
        return;
      }

      await interaction.deferUpdate();
      try {
        await agentModGate(modGate.kind, modGate.taskId, modGate.seq, modGate.decision);
        await interaction.message.edit({ components: [] });
        const channel = interaction.channel as TextChannel | null;
        await channel?.send(modGateAck(modGate.kind, modGate.decision));
      } catch (error) {
        console.error('Agent mod-gate button error:', error);
        await interaction.followUp({ content: '無法連線 Agent 服務，請稍後再試。', ephemeral: true });
      }
      return;
    }

    if (interaction.customId === 'mc_refresh') {
      await interaction.deferUpdate();
      try {
        const config = getMcServer(interaction.guild!.id);
        if (!config) return;
        const { queryServer, buildStatusEmbed } = await import('../utils/minecraft.ts');
        const serverData = await queryServer(config.host, config.port);
        const embedData = buildStatusEmbed(serverData);
        await interaction.message.edit(embedData);
      } catch (error) {
        console.error('MC refresh button error:', error);
      }
    }
  }
}

interface ParsedModGate {
  kind: ModGateKind;
  taskId: number;
  seq: number;
  decision: 'approve' | 'deny';
}

// Parses a mod-gate button customId. Returns null if it isn't one.
//   agentapprove_(yes|no)_<taskId>_<seq>_<requesterId>
//   agentmerge_(yes|no)_<taskId>_<requesterId>
function parseModGate(customId: string): ParsedModGate | null {
  const approve = customId.match(/^agentapprove_(yes|no)_(\d+)_(\d+)_(\d+)$/);
  if (approve) {
    return {
      kind: 'approve',
      taskId: Number(approve[2]),
      seq: Number(approve[3]),
      decision: approve[1] === 'yes' ? 'approve' : 'deny',
    };
  }
  const merge = customId.match(/^agentmerge_(yes|no)_(\d+)_(\d+)$/);
  if (merge) {
    return {
      kind: 'merge',
      taskId: Number(merge[2]),
      seq: 0,
      decision: merge[1] === 'yes' ? 'approve' : 'deny',
    };
  }
  return null;
}

function modGateAck(kind: ModGateKind, decision: 'approve' | 'deny'): string {
  if (kind === 'merge') {
    return decision === 'approve' ? '已核准合併，部署中…' : '已駁回此 PR。';
  }
  return decision === 'approve' ? '已核准此變更。' : '已拒絕此變更。';
}
