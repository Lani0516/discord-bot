import 'dotenv/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
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
client.login(process.env.BOT_TOKEN);
