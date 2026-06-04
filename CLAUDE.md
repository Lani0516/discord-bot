# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `bun install` — install dependencies
- `bun run deploy` — register slash commands with Discord (guild-scoped)
- `bun start` — start the bot
- `bun run dev` — start with --watch for auto-reload
- `bun test` — run tests
- `bun run typecheck` — run TypeScript type checking

## Architecture
- TypeScript with Bun runtime, ESM modules throughout (import/export)
- discord.js v14 with slash commands only
- `src/types.ts` defines shared interfaces (BotCommand, BotEvent, DB row types, discord.js Client augmentation)
- `src/index.ts` loads commands from `src/commands/**/*.ts` and events from `src/events/*.ts`
- Each command exports `{ data: SlashCommandBuilder, execute: async (interaction: ChatInputCommandInteraction) => void }`
- Each event exports `{ name: string, once?: boolean, execute: (...args) => void }`
- `database.ts` exports pure functions using bun:sqlite sync API
- SQLite at `./data/bot.db` (auto-created)
- Tables: `chat_history`, `server_config`, `mc_servers`

## Environment Variables
- `BOT_TOKEN` — Discord bot token
- `GEMINI_API_KEY` — Google Gemini API key
- `CLIENT_ID` — Discord application/client ID
- `GUILD_ID` — Guild ID for development command registration
- `AGENT_SERVICE_URL` — base URL of the M2 agent service (e.g. `http://agent:8090`)
- `INTERNAL_SECRET` — shared secret for bot↔agent internal API (`X-Internal-Secret`); must match the agent

## Agent service (M2)
- The coding agent lives in a **separate repo** (`../discord-agent-service`), deployed as the `agent` service in `docker-compose.yml`. Internal docker network only, no published ports.
- Bot forwards messages in the `agent_channel_id` channel to the agent via `POST /ingest`; the agent posts replies back to `POST /internal/reply` on the bot's health port (8080). Both calls authenticate with `INTERNAL_SECRET`.
- `/set-agent-channel` (ManageGuild) sets `agent_channel_id` in `server_config`. The existing Gemini `ai_channel_id` path is unaffected.

## Conventions
- All commands are slash commands, organized in subdirectories by category: admin, fun, ai, minecraft
- Secrets loaded via dotenv from `.env` file (never committed)
- AI chat uses Google Gemini (gemini-2.0-flash) with per-user-per-guild history
- Default bot language: 繁體中文
