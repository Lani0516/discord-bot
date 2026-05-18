# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm install` — install dependencies
- `npm run deploy` — register slash commands with Discord (guild-scoped)
- `npm start` — start the bot
- `npm run dev` — start with --watch for auto-reload
- `npm test` — run tests (node:test)

## Architecture
- Node.js v24, ESM modules throughout (import/export)
- discord.js v14 with slash commands only
- `src/index.js` loads commands from `src/commands/**/*.js` and events from `src/events/*.js`
- Each command exports `{ data: SlashCommandBuilder, execute: async (interaction) => void }`
- Each event exports `{ name: string, once?: boolean, execute: (...args) => void }`
- `database.js` exports pure functions using better-sqlite3 sync API
- SQLite at `./data/bot.db` (auto-created)
- Tables: `chat_history`, `server_config`, `mc_servers`

## Environment Variables
- `BOT_TOKEN` — Discord bot token
- `GEMINI_API_KEY` — Google Gemini API key
- `CLIENT_ID` — Discord application/client ID
- `GUILD_ID` — Guild ID for development command registration

## Conventions
- All commands are slash commands, organized in subdirectories by category: admin, fun, ai, minecraft
- Secrets loaded via dotenv from `.env` file (never committed)
- AI chat uses Google Gemini (gemini-2.0-flash) with per-user-per-guild history
- Default bot language: 繁體中文
