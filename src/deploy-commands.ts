import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { BotCommand } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const commands: ReturnType<BotCommand['data']['toJSON']>[] = [];
const commandsPath = join(__dirname, 'commands');
const commandFiles = loadCommandsFromDir(commandsPath);

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

for (const filePath of commandFiles) {
  const command = await import(pathToFileURL(filePath).href) as Partial<BotCommand>;
  if (command.data) {
    commands.push(command.data.toJSON());
  }
}

const botToken = requireEnv('BOT_TOKEN');
const clientId = getClientId(botToken);
const guildId = requireEnv('GUILD_ID');

const rest = new REST().setToken(botToken);

try {
  console.log(`Registering ${commands.length} slash commands...`);
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands },
  );
  console.log(`Successfully registered ${commands.length} commands.`);
} catch (error) {
  console.error('Failed to register commands:', error);
}
