import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { timingSafeEqual } from 'node:crypto';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { initDb } from './database.ts';
import type { BotCommand, BotEvent } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

function loadCommandsFromDir(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...loadCommandsFromDir(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const commandsPath = join(__dirname, 'commands');
const commandFiles = loadCommandsFromDir(commandsPath);

for (const filePath of commandFiles) {
  const command = await import(pathToFileURL(filePath).href) as Partial<BotCommand>;
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command as BotCommand);
  } else {
    console.warn(`[WARNING] Command at ${filePath} missing "data" or "execute" export.`);
  }
}

const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.ts'));

for (const file of eventFiles) {
  const filePath = join(eventsPath, file);
  const event = await import(pathToFileURL(filePath).href) as BotEvent;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

initDb();

// Smoke / dry-boot: load everything, prove the process starts, then exit 0.
// Used by CI smoke-boot and local image verification (no Discord login).
if (process.env.SMOKE_TEST === '1') {
  console.log('[smoke] boot ok: commands + events + db initialised');
  process.exit(0);
}

// Liveness endpoint for container healthcheck / crash-loop monitor,
// plus the internal API the agent service calls to post replies back.
const healthPort = Number(process.env.HEALTH_PORT ?? 8080);
Bun.serve({
  port: healthPort,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/internal/reply') {
      return handleInternalReply(req);
    }

    if (req.method === 'POST' && url.pathname === '/internal/plan') {
      return handleInternalPlan(req);
    }

    const ready = client.isReady();
    return new Response(ready ? 'ok' : 'starting', { status: ready ? 200 : 503 });
  },
});

function secretEquals(got: string | null, expected: string | undefined): boolean {
  if (!expected || got === null) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface InternalReplyBody {
  channelId: string;
  content: string;
}

async function handleInternalReply(req: Request): Promise<Response> {
  if (!secretEquals(req.headers.get('x-internal-secret'), process.env.INTERNAL_SECRET)) {
    return new Response('unauthorized', { status: 401 });
  }

  let body: InternalReplyBody;
  try {
    body = (await req.json()) as InternalReplyBody;
  } catch {
    return new Response('bad json', { status: 400 });
  }

  if (!body.channelId || typeof body.content !== 'string') {
    return new Response('bad request', { status: 400 });
  }

  try {
    const channel = await client.channels.fetch(body.channelId);
    if (!channel || !channel.isSendable()) {
      return new Response('channel not sendable', { status: 404 });
    }
    for (const chunk of chunkMessage(body.content)) {
      await channel.send(chunk);
    }
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('[internal/reply] send failed:', err);
    return new Response('send failed', { status: 500 });
  }
}

interface InternalPlanBody {
  channelId: string;
  requesterId: string;
  taskId: number;
  planText: string;
}

async function handleInternalPlan(req: Request): Promise<Response> {
  if (!secretEquals(req.headers.get('x-internal-secret'), process.env.INTERNAL_SECRET)) {
    return new Response('unauthorized', { status: 401 });
  }

  let body: InternalPlanBody;
  try {
    body = (await req.json()) as InternalPlanBody;
  } catch {
    return new Response('bad json', { status: 400 });
  }

  if (
    !body.channelId ||
    !body.requesterId ||
    typeof body.taskId !== 'number' ||
    typeof body.planText !== 'string'
  ) {
    return new Response('bad request', { status: 400 });
  }

  try {
    const channel = await client.channels.fetch(body.channelId);
    if (!channel || !channel.isSendable()) {
      return new Response('channel not sendable', { status: 404 });
    }
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`agent_start_${body.taskId}_${body.requesterId}`)
        .setLabel('開始')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`agent_cancel_${body.taskId}_${body.requesterId}`)
        .setLabel('取消')
        .setStyle(ButtonStyle.Secondary),
    );
    const chunks = chunkMessage(body.planText);
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await channel.send(isLast ? { content: chunks[i], components: [row] } : chunks[i]);
    }
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('[internal/plan] send failed:', err);
    return new Response('send failed', { status: 500 });
  }
}

function chunkMessage(text: string, maxLength = 2000): string[] {
  if (text.length === 0) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

client.login(process.env.BOT_TOKEN);
