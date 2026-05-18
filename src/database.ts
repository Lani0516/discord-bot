import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ChatHistoryRow, McServerRow, McServerInput } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, '..', 'data');
mkdirSync(dbDir, { recursive: true });

const db = new Database(join(dbDir, 'bot.db'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_chat_history_lookup
    ON chat_history(user_id, guild_id, created_at);

  CREATE TABLE IF NOT EXISTS server_config (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (guild_id, key)
  );

  CREATE TABLE IF NOT EXISTS mc_servers (
    guild_id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 25565,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    refresh_minutes INTEGER NOT NULL DEFAULT 5
  );
`);

export function initDb(): void {}

const stmts = {
  getChatHistory: db.prepare(
    `SELECT role, content FROM chat_history
     WHERE user_id = ? AND guild_id = ?
     ORDER BY created_at DESC LIMIT ?`
  ),
  addChatMessage: db.prepare(
    `INSERT INTO chat_history (user_id, guild_id, role, content) VALUES (?, ?, ?, ?)`
  ),
  clearChatHistory: db.prepare(
    `DELETE FROM chat_history WHERE user_id = ? AND guild_id = ?`
  ),
  getServerConfig: db.prepare(
    `SELECT value FROM server_config WHERE guild_id = ? AND key = ?`
  ),
  setServerConfig: db.prepare(
    `INSERT OR REPLACE INTO server_config (guild_id, key, value) VALUES (?, ?, ?)`
  ),
  getMcServer: db.prepare(
    `SELECT * FROM mc_servers WHERE guild_id = ?`
  ),
  setMcServer: db.prepare(
    `INSERT OR REPLACE INTO mc_servers (guild_id, host, port, channel_id, message_id, refresh_minutes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  updateMcMessageId: db.prepare(
    `UPDATE mc_servers SET message_id = ? WHERE guild_id = ?`
  ),
  removeMcServer: db.prepare(
    `DELETE FROM mc_servers WHERE guild_id = ?`
  ),
  getAllMcServers: db.prepare(
    `SELECT * FROM mc_servers`
  ),
};

export function getChatHistory(userId: string, guildId: string, limit: number = 50): Pick<ChatHistoryRow, 'role' | 'content'>[] {
  return (stmts.getChatHistory.all(userId, guildId, limit) as Pick<ChatHistoryRow, 'role' | 'content'>[]).reverse();
}

export function addChatMessage(userId: string, guildId: string, role: 'user' | 'model', content: string): void {
  stmts.addChatMessage.run(userId, guildId, role, content);
}

export function clearChatHistory(userId: string, guildId: string): void {
  stmts.clearChatHistory.run(userId, guildId);
}

export function getServerConfig(guildId: string, key: string): string | null {
  const row = stmts.getServerConfig.get(guildId, key) as { value: string } | null;
  return row ? row.value : null;
}

export function setServerConfig(guildId: string, key: string, value: string): void {
  stmts.setServerConfig.run(guildId, key, value);
}

export function getMcServer(guildId: string): McServerRow | undefined {
  return (stmts.getMcServer.get(guildId) as McServerRow | null) ?? undefined;
}

export function setMcServer(guildId: string, { host, port, channelId, messageId, refreshMinutes }: McServerInput): void {
  stmts.setMcServer.run(guildId, host, port, channelId, messageId ?? null, refreshMinutes);
}

export function updateMcMessageId(guildId: string, messageId: string): void {
  stmts.updateMcMessageId.run(messageId, guildId);
}

export function removeMcServer(guildId: string): void {
  stmts.removeMcServer.run(guildId);
}

export function getAllMcServers(): McServerRow[] {
  return stmts.getAllMcServers.all() as McServerRow[];
}
