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
      protocol: result.version.protocol,
      motd: result.motd.clean,
      motdRaw: result.motd.raw,
      latency: result.roundTripLatency,
      players: {
        online: result.players.online,
        max: result.players.max,
        sample: result.players.sample,
      },
    };
  } catch {
    return { online: false, host, port };
  }
}

const ONLINE_COLOR = 0x57f287;
const OFFLINE_COLOR = 0xed4245;
const BAR_SIZE = 12;
const ANSI_RESET = '\u001b[0m';

const MINECRAFT_ANSI_COLORS: Record<string, number> = {
  '0': 30,
  '1': 34,
  '2': 32,
  '3': 36,
  '4': 31,
  '5': 35,
  '6': 33,
  '7': 37,
  '8': 30,
  '9': 34,
  a: 32,
  b: 36,
  c: 31,
  d: 35,
  e: 33,
  f: 37,
};

function formatAddress(data: Pick<McServerStatus, 'host' | 'port'>) {
  return isNumericIpAddress(data.host) ? `${data.host}:${data.port}` : data.host;
}

function buildMcStatusWidgetUrl(address: string) {
  const cacheBust = Math.floor(Date.now() / 60_000);
  const encodedAddress = encodeURIComponent(address);
  return `https://api.mcstatus.io/v2/widget/java/${encodedAddress}?dark=true&rounded=true&timeout=5&refresh=${cacheBust}`;
}

function isNumericIpAddress(host: string) {
  const parts = host.split('.');
  return parts.length === 4 && parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatMotd(data: Pick<McServerStatus, 'motd' | 'motdRaw'>) {
  const rawMotd = data.motdRaw?.trim();
  if (rawMotd) return formatAnsiMotd(rawMotd);

  const cleanMotd = data.motd?.trim();
  if (!cleanMotd) return '無公告';
  return truncate(cleanMotd.replace(/\s*\n\s*/g, '\n'), 500);
}

function formatAnsiMotd(rawMotd: string) {
  const motd = rawMotd.replace(/\s*\n\s*/g, '\n');
  let ansi = '';

  for (let i = 0; i < motd.length; i++) {
    const char = motd[i];
    const code = motd[i + 1]?.toLowerCase();

    if (char === '§' && code) {
      const color = MINECRAFT_ANSI_COLORS[code];
      if (color) {
        ansi += `${ANSI_RESET}\u001b[${color}m`;
        i++;
        continue;
      }

      if (code === 'l') {
        ansi += '\u001b[1m';
        i++;
        continue;
      }

      if (code === 'n') {
        ansi += '\u001b[4m';
        i++;
        continue;
      }

      if (code === 'r') {
        ansi += ANSI_RESET;
        i++;
        continue;
      }

      if (code === 'k' || code === 'm' || code === 'o') {
        i++;
        continue;
      }
    }

    ansi += char;
  }

  return `\`\`\`ansi\n${truncate(ansi, 850)}${ANSI_RESET}\n\`\`\``;
}

function formatLatency(latency?: number) {
  if (typeof latency !== 'number') return '未知';
  return `${Math.round(latency)} ms`;
}

function buildPlayerBar(online: number, max: number) {
  if (max <= 0) return '無玩家上限資料';

  const filled = Math.round((Math.min(online, max) / max) * BAR_SIZE);
  const empty = BAR_SIZE - filled;
  const percent = Math.round((online / max) * 100);

  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percent}%`;
}

function formatPlayerSample(players?: McServerStatus['players']) {
  const sample = players?.sample?.filter(player => player.name.trim());
  if (!sample?.length) return players?.online ? '伺服器未提供玩家清單' : '目前沒有玩家在線';

  const visiblePlayers = sample.slice(0, 10).map(player => player.name).join('、');
  const remaining = Math.max((players?.online ?? sample.length) - sample.length, 0);
  const suffix = remaining > 0 ? `，另有 ${remaining} 位` : '';

  return truncate(`${visiblePlayers}${suffix}`, 500);
}

export function buildStatusEmbed(data: McServerStatus) {
  const address = formatAddress(data);
  const embed = new EmbedBuilder()
    .setAuthor({ name: 'Minecraft Java 伺服器狀態' })
    .setImage(buildMcStatusWidgetUrl(address))
    .setTimestamp();

  if (data.online) {
    const onlinePlayers = data.players!.online;
    const maxPlayers = data.players!.max;

    embed
      .setColor(ONLINE_COLOR)
      .setTitle('伺服器在線')
      .setDescription(formatMotd(data))
      .addFields(
        { name: '連線位址', value: `\`${address}\``, inline: true },
        { name: '版本', value: data.protocol ? `${data.version!} (${data.protocol})` : data.version!, inline: true },
        { name: '延遲', value: formatLatency(data.latency), inline: true },
        { name: '玩家', value: `${onlinePlayers} / ${maxPlayers}`, inline: true },
        { name: '容量', value: buildPlayerBar(onlinePlayers, maxPlayers), inline: true },
        { name: '線上名單', value: formatPlayerSample(data.players) },
      )
      .setFooter({ text: '最後更新' });
  } else {
    embed
      .setColor(OFFLINE_COLOR)
      .setTitle('伺服器離線')
      .setDescription('目前無法連線，可能正在維護、暫時關閉，或主機位址/連接埠設定有誤。')
      .addFields(
        { name: '連線位址', value: `\`${address}\``, inline: true },
        { name: '狀態', value: '無回應', inline: true },
      )
      .setFooter({ text: '最後更新' });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('mc_refresh')
      .setLabel('刷新狀態')
      .setStyle(data.online ? ButtonStyle.Success : ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}
