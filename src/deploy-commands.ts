import 'dotenv/config';
import { loadSlashCommandPayloads, registerGuildSlashCommands } from './utils/slashCommands.ts';

try {
  const commands = await loadSlashCommandPayloads();
  console.log(`Registering ${commands.length} slash commands...`);
  const count = await registerGuildSlashCommands(commands);
  console.log(`Successfully registered ${count} commands.`);
} catch (error) {
  console.error('Failed to register commands:', error);
  process.exit(1);
}
