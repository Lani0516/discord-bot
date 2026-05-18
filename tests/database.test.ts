import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync } from 'fs';
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
    for (let i = 0; i < 60; i++) {
      addChatMessage(userId, guildId, 'user', `msg ${i}`);
    }
    const history = getChatHistory(userId, guildId, 10);
    assert.equal(history.length, 10);
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
