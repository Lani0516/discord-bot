import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initDb,
  getChatHistory,
  addChatMessage,
  clearChatHistory,
  getServerConfig,
  setServerConfig,
  getMcServer,
  setMcServer,
  updateMcMessageId,
  removeMcServer,
  getAllMcServers,
  recordAiUsage,
  getMonthlyAiUsage,
  getMonthlyUserAiUsage,
} from '../src/database.ts';
import type { McServerRow } from '../src/types.ts';

before(() => {
  initDb();
});

describe('chat_history', () => {
  const userId = 'test_user_1';
  const guildId = 'test_guild_1';

  it('starts empty', () => {
    const history = getChatHistory(userId, guildId);
    assert.equal(history.length, 0);
  });

  it('adds and retrieves messages', () => {
    addChatMessage(userId, guildId, 'user', 'hello');
    addChatMessage(userId, guildId, 'model', 'hi there');
    const history = getChatHistory(userId, guildId);
    assert.equal(history.length, 2);
    assert.equal(history[0].role, 'user');
    assert.equal(history[0].content, 'hello');
    assert.equal(history[1].role, 'model');
  });

  it('respects limit', () => {
    clearChatHistory(userId, guildId);
    for (let i = 0; i < 60; i++) {
      addChatMessage(userId, guildId, 'user', `msg ${i}`);
    }
    const history = getChatHistory(userId, guildId, 10);
    assert.equal(history.length, 10);
  });

  it('keeps only the 20 most recent messages by default', () => {
    clearChatHistory(userId, guildId);
    for (let i = 0; i < 25; i++) {
      addChatMessage(userId, guildId, 'user', `msg ${i}`);
    }
    const history = getChatHistory(userId, guildId);
    assert.equal(history.length, 20);
    assert.equal(history[0].content, 'msg 5');
    assert.equal(history[19].content, 'msg 24');
  });

  it('clears history', () => {
    clearChatHistory(userId, guildId);
    const history = getChatHistory(userId, guildId);
    assert.equal(history.length, 0);
  });
});

describe('server_config', () => {
  const guildId = 'test_guild_2';

  it('returns null for missing key', () => {
    assert.equal(getServerConfig(guildId, 'nonexistent'), null);
  });

  it('sets and gets config', () => {
    setServerConfig(guildId, 'test_key', 'test_value');
    assert.equal(getServerConfig(guildId, 'test_key'), 'test_value');
  });

  it('upserts config', () => {
    setServerConfig(guildId, 'test_key', 'new_value');
    assert.equal(getServerConfig(guildId, 'test_key'), 'new_value');
  });
});

describe('ai_usage', () => {
  const guildId = 'test_guild_usage';
  const userId = 'test_user_usage';
  const monthStartUnix = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  it('records and summarizes monthly AI usage', () => {
    recordAiUsage({
      guildId,
      userId,
      model: 'gemini-2.5-flash',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.000155,
    });

    const guildUsage = getMonthlyAiUsage(guildId, monthStartUnix);
    const userUsage = getMonthlyUserAiUsage(guildId, userId, monthStartUnix);

    assert.equal(guildUsage.requests, 1);
    assert.equal(guildUsage.promptTokens, 100);
    assert.equal(guildUsage.completionTokens, 50);
    assert.equal(guildUsage.totalTokens, 150);
    assert.equal(userUsage.requests, 1);
  });
});

describe('mc_servers', () => {
  const guildId = 'test_guild_3';

  it('returns undefined for missing guild', () => {
    assert.equal(getMcServer(guildId), undefined);
  });

  it('sets and gets MC server', () => {
    setMcServer(guildId, {
      host: 'mc.example.com',
      port: 25565,
      channelId: '123',
      messageId: '456',
      refreshMinutes: 5,
    });
    const server = getMcServer(guildId) as McServerRow;
    assert.equal(server.host, 'mc.example.com');
    assert.equal(server.port, 25565);
    assert.equal(server.channel_id, '123');
    assert.equal(server.message_id, '456');
  });

  it('updates message ID', () => {
    updateMcMessageId(guildId, '789');
    assert.equal(getMcServer(guildId)!.message_id, '789');
  });

  it('lists all servers', () => {
    const all = getAllMcServers();
    assert.ok(all.length >= 1);
  });

  it('removes MC server', () => {
    removeMcServer(guildId);
    assert.equal(getMcServer(guildId), undefined);
  });
});
