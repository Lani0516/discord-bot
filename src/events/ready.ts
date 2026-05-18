import { Events, ActivityType, Client, TextChannel } from 'discord.js';
import { getAllMcServers } from '../database.ts';
import type { McServerRow, McServerStatus } from '../types.ts';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  console.log(`Logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} guilds.`);
  client.user.setActivity('伺服器管理中 | /help', { type: ActivityType.Listening });

  client.mcIntervals = new Map();
  const mcServers = getAllMcServers();
  if (mcServers.length > 0) {
    const { queryServer, buildStatusEmbed } = await import('../utils/minecraft.ts');
    for (const config of mcServers) {
      startMcInterval(client, config, queryServer, buildStatusEmbed);
    }
  }
}

function startMcInterval(
  client: Client,
  config: McServerRow,
  queryServer: (host: string, port?: number) => Promise<McServerStatus>,
  buildStatusEmbed: (data: McServerStatus) => ReturnType<typeof import('../utils/minecraft.ts').buildStatusEmbed>,
) {
  const interval = setInterval(async () => {
    try {
      const data = await queryServer(config.host, config.port);
      const embedData = buildStatusEmbed(data);
      const channel = await client.channels.fetch(config.channel_id).catch(() => null) as TextChannel | null;
      if (!channel) return;

      if (config.message_id) {
        const msg = await channel.messages.fetch(config.message_id).catch(() => null);
        if (msg) {
          await msg.edit(embedData);
        } else {
          const newMsg = await channel.send(embedData);
          const { updateMcMessageId } = await import('../database.ts');
          updateMcMessageId(config.guild_id, newMsg.id);
          config.message_id = newMsg.id;
        }
      }
    } catch (err) {
      console.error(`MC status refresh failed for ${config.host}:`, (err as Error).message);
    }
  }, config.refresh_minutes * 60 * 1000);

  client.mcIntervals.set(config.guild_id, interval);
}
