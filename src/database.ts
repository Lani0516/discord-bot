import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ChatHistoryRow, McServerRow, McServerInput, AiUsageInput, AiUsageSummary } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, '..', 'data');
mkdirSync(dbDir, { recursive: true });
const chatHistoryDir = join(dbDir, 'chat-history');
mkdirSync(chatHistoryDir, { recursive: true });

const db = new Database(join(dbDir, 'bot.db'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
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

  CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    estimated_cost_usd REAL NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_ai_usage_guild_created_at
    ON ai_usage(guild_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created_at
    ON ai_usage(user_id, guild_id, created_at);
`);

export function initDb(): void {}

const CHAT_HISTORY_LIMIT = 20;
const chatDbs = new Map<string, Database>();

function safePathSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getChatDb(userId: string, guildId: string): Database {
  const safeGuildId = safePathSegment(guildId);
  const safeUserId = safePathSegment(userId);
  const guildDir = join(chatHistoryDir, safeGuildId);
  mkdirSync(guildDir, { recursive: true });

  const dbPath = join(guildDir, `${safeUserId}.db`);
  const cached = chatDbs.get(dbPath);
  if (cached) return cached;

  const chatDb = new Database(dbPath);
  chatDb.exec('PRAGMA journal_mode = WAL');
  chatDb.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('user', 'model')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_chat_history_created_at
      ON chat_history(created_at, id);
  `);
  chatDbs.set(dbPath, chatDb);
  return chatDb;
}

function migrateLegacyChatHistory(): void {
  const legacyTable = db
    .query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_history'`)
    .get() as { name: string } | null;
  if (!legacyTable) return;

  const legacyRows = db
    .query(
      `SELECT user_id, guild_id, role, content
       FROM chat_history
       ORDER BY created_at ASC, id ASC`
    )
    .all() as Pick<ChatHistoryRow, 'user_id' | 'guild_id' | 'role' | 'content'>[];

  for (const row of legacyRows) {
    addChatMessage(row.user_id, row.guild_id, row.role, row.content);
  }

  db.exec(`DROP TABLE chat_history`);
}

migrateLegacyChatHistory();

const stmts = {
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
  recordAiUsage: db.prepare(
    `INSERT INTO ai_usage (
       guild_id, user_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  getMonthlyAiUsage: db.prepare(
    `SELECT
       COUNT(*) AS requests,
       COALESCE(SUM(prompt_tokens), 0) AS promptTokens,
       COALESCE(SUM(completion_tokens), 0) AS completionTokens,
       COALESCE(SUM(total_tokens), 0) AS totalTokens,
       COALESCE(SUM(estimated_cost_usd), 0) AS estimatedCostUsd
     FROM ai_usage
     WHERE guild_id = ? AND created_at >= ?`
  ),
  getMonthlyUserAiUsage: db.prepare(
    `SELECT
       COUNT(*) AS requests,
       COALESCE(SUM(prompt_tokens), 0) AS promptTokens,
       COALESCE(SUM(completion_tokens), 0) AS completionTokens,
       COALESCE(SUM(total_tokens), 0) AS totalTokens,
       COALESCE(SUM(estimated_cost_usd), 0) AS estimatedCostUsd
     FROM ai_usage
     WHERE guild_id = ? AND user_id = ? AND created_at >= ?`
  ),
};

export function getChatHistory(userId: string, guildId: string, limit: number = CHAT_HISTORY_LIMIT): Pick<ChatHistoryRow, 'role' | 'content'>[] {
  const chatDb = getChatDb(userId, guildId);
  return chatDb
    .query(
      `SELECT role, content FROM chat_history
       ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(limit)
    .reverse() as Pick<ChatHistoryRow, 'role' | 'content'>[];
}

export function addChatMessage(userId: string, guildId: string, role: 'user' | 'model', content: string): void {
  const chatDb = getChatDb(userId, guildId);
  chatDb
    .query(`INSERT INTO chat_history (role, content) VALUES (?, ?)`)
    .run(role, content);
  chatDb
    .query(
      `DELETE FROM chat_history
       WHERE id NOT IN (
         SELECT id FROM chat_history
         ORDER BY created_at DESC, id DESC LIMIT ?
       )`
    )
    .run(CHAT_HISTORY_LIMIT);
}

export function clearChatHistory(userId: string, guildId: string): void {
  getChatDb(userId, guildId).query(`DELETE FROM chat_history`).run();
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

export function recordAiUsage(usage: AiUsageInput): void {
  stmts.recordAiUsage.run(
    usage.guildId,
    usage.userId,
    usage.model,
    usage.promptTokens,
    usage.completionTokens,
    usage.totalTokens,
    usage.estimatedCostUsd,
  );
}

export function getMonthlyAiUsage(guildId: string, monthStartUnix: number): AiUsageSummary {
  return stmts.getMonthlyAiUsage.get(guildId, monthStartUnix) as AiUsageSummary;
}

export function getMonthlyUserAiUsage(guildId: string, userId: string, monthStartUnix: number): AiUsageSummary {
  return stmts.getMonthlyUserAiUsage.get(guildId, userId, monthStartUnix) as AiUsageSummary;
}
