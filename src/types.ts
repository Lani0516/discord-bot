import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  Collection,
} from 'discord.js';

export interface BotCommand {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, BotCommand>;
    cooldowns: Collection<string, number>;
    mcIntervals: Map<string, Timer>;
  }
}

export interface ChatHistoryRow {
  id: number;
  user_id: string;
  guild_id: string;
  role: 'user' | 'model';
  content: string;
  created_at: number;
}

export interface ServerConfigRow {
  guild_id: string;
  key: string;
  value: string | null;
}

export interface McServerRow {
  guild_id: string;
  host: string;
  port: number;
  channel_id: string;
  message_id: string | null;
  refresh_minutes: number;
}

export interface McServerInput {
  host: string;
  port: number;
  channelId: string;
  messageId?: string | null;
  refreshMinutes: number;
}

export interface McServerStatus {
  online: boolean;
  host: string;
  port: number;
  version?: string;
  motd?: string;
  players?: { online: number; max: number };
}
