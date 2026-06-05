import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { BotCommand } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type SlashCommandPayload = ReturnType<BotCommand['data']['toJSON']>;

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

export function getCommandFiles(): string[] {
  return loadCommandsFromDir(join(__dirname, '..', 'commands'));
}

export async function loadCommandModules(): Promise<Partial<BotCommand>[]> {
  const commands: Partial<BotCommand>[] = [];
  for (const filePath of getCommandFiles()) {
    commands.push(await import(pathToFileURL(filePath).href) as Partial<BotCommand>);
  }
  return commands;
}

export async function loadSlashCommandPayloads(): Promise<SlashCommandPayload[]> {
  const commands: SlashCommandPayload[] = [];
  for (const command of await loadCommandModules()) {
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }
  return commands;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getClientId(botToken: string): string {
  const configuredClientId = getEnv('CLIENT_ID');
  if (configuredClientId) return configuredClientId;

  const tokenId = botToken.split('.')[0];
  const decodedId = Buffer.from(tokenId, 'base64url').toString('utf8');

  if (!/^\d{17,20}$/.test(decodedId)) {
    throw new Error('Missing required environment variable: CLIENT_ID');
  }

  console.warn('CLIENT_ID is empty; using the bot id decoded from BOT_TOKEN.');
  return decodedId;
}

export async function registerGuildSlashCommands(commands?: SlashCommandPayload[]): Promise<number> {
  const body = commands ?? await loadSlashCommandPayloads();
  const botToken = requireEnv('BOT_TOKEN');
  const clientId = getClientId(botToken);
  const guildId = requireEnv('GUILD_ID');

  const rest = new REST().setToken(botToken);
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body },
  );
  return body.length;
}
