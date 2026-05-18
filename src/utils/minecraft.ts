import { status } from 'minecraft-server-util';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { McServerStatus } from '../types.ts';

export async function queryServer(host: string, port: number = 25565): Promise<McServerStatus> {
  try {
    const result = await status(host, port, { timeout: 5000 });
    return {
      online: true,
      host,
      port,
      version: result.version.name,
      motd: result.motd.clean,
      players: { online: result.players.online, max: result.players.max },
    };
  } catch {
    return { online: false, host, port };
  }
}

export function buildStatusEmbed(data: McServerStatus) {
  const embed = new EmbedBuilder().setTimestamp();

  if (data.online) {
    embed
      .setColor(0x00ff00)
      .setTitle('Minecraft 伺服器狀態')
      .addFields(
        { name: '主機位址', value: `\`${data.host}:${data.port}\``, inline: true },
        { name: '遊戲版本', value: data.version!, inline: true },
        { name: '在線玩家', value: `${data.players!.online} / ${data.players!.max}`, inline: true },
        { name: '伺服器公告 (MOTD)', value: data.motd || '無' },
      )
      .setFooter({ text: '最後更新' });
  } else {
    embed
      .setColor(0xff0000)
      .setTitle('Minecraft 伺服器狀態')
      .setDescription('伺服器目前離線，可能正在維護或暫時關閉')
      .addFields({ name: '主機位址', value: `\`${data.host}:${data.port}\`` })
      .setFooter({ text: '最後更新' });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('mc_refresh')
      .setLabel('重新整理狀態')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}
