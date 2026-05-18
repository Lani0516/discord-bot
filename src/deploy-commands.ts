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

for (const filePath of commandFiles) {
  const command = await import(pathToFileURL(filePath).href) as Partial<BotCommand>;
  if (command.data) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.BOT_TOKEN!);

try {
  console.log(`Registering ${commands.length} slash commands...`);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
    { body: commands },
  );
  console.log(`Successfully registered ${commands.length} commands.`);
} catch (error) {
  console.error('Failed to register commands:', error);
}
