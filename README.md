# Discord Bot

Multi-purpose Discord bot built with Bun, TypeScript, and discord.js v14. It provides slash-command server administration, fun commands, Google Gemini chat, Minecraft Java server monitoring, and an optional self-modifying coding agent backed by a separate `discord-agent-service`.

Traditional Chinese documentation is available at [README.zh-TW.md](README.zh-TW.md).

## Features

### Server Administration

| Command | Purpose | Required permission |
| --- | --- | --- |
| `/ban` | Ban a member, optionally deleting 0-7 days of recent messages and recording a reason. | Ban Members |
| `/kick` | Kick a member with an optional reason. | Kick Members |
| `/mute` | Timeout a member for 1-10080 minutes. | Moderate Members |
| `/unmute` | Remove a member timeout. | Moderate Members |
| `/purge` | Bulk-delete channel messages, optionally scoped to one member. | Manage Messages |
| `/serverinfo` | Show current Discord server information. | None |
| `/userinfo` | Show account and server information for yourself or another user. | None |

### AI Chat

Gemini chat can run in a configured auto-reply channel or by mentioning the bot. The bot stores recent per-user, per-guild conversation history so replies can use context.

| Command | Purpose | Required permission |
| --- | --- | --- |
| `/set-ai-channel` | Set or clear the AI auto-reply channel. | Manage Server |
| `/set-system-prompt` | Set this guild's Gemini system prompt. | Manage Server |
| `/view-system-prompt` | View the current Gemini system prompt. | None |
| `/clear-history` | Clear your own AI chat history. | None |
| `/ai-usage` | View monthly Gemini usage and estimated cost. | Manage Server |

### Coding Agent

The coding agent is optional and runs as a separate container/image (`ghcr.io/lani0516/discord-agent-service`). The bot only forwards Discord messages and button decisions; the agent service owns DeepSeek, GitHub PR workflow, task state, worktrees, approvals, and operational guardrails.

| Command | Purpose | Required permission |
| --- | --- | --- |
| `/set-agent-channel` | Set or clear the channel where users can talk to the coding agent. | Manage Server |
| `/agent-stop` | Stop a queued, running, confirmation, approval, merge, or working agent task by task id. | Manage Server |

Agent modify requests follow this flow:

1. A user posts a request in the configured agent channel.
2. The bot forwards the message to `discord-agent-service`.
3. The agent classifies the request, posts a plan, and waits for the requester to press Start or Cancel.
4. For approved work, the agent creates a branch/worktree, changes repo A (`discord-bot`), opens a GitHub PR, waits for CI, then asks a Manage Server moderator to Merge or Reject.
5. Infrastructure and guardrail paths remain protected. Dependency changes require moderator approval before writing.

### Fun Commands

| Command | Purpose |
| --- | --- |
| `/8ball` | Ask a magic 8-ball question. |
| `/coinflip` | Flip a coin. |
| `/dice` | Roll one or more dice with configurable sides. |
| `/poll` | Create a poll with up to five options. |
| `/ping` / `/pong` | Simple response commands used for smoke checks and examples. |

### Minecraft Server Monitoring

| Command | Purpose | Required permission |
| --- | --- | --- |
| `/mc-setup` | Configure a Minecraft Java server, display channel, port, and update interval. | Manage Server |
| `/mc-status` | Check a configured server or an arbitrary server. | None |
| `/mc-remove` | Remove the current guild's Minecraft monitor configuration. | Manage Server |

## Architecture

- Runtime: Bun
- Language: TypeScript with ESM modules
- Discord SDK: discord.js v14
- AI chat: Google Gemini API
- Coding agent: separate `discord-agent-service` container using DeepSeek and GitHub PRs
- Database: SQLite via Bun APIs
- Minecraft status: `minecraft-server-util`

```text
src/
|-- index.ts                 # Bot entrypoint, health server, internal agent callbacks
|-- deploy-commands.ts       # Guild slash-command registration
|-- database.ts              # SQLite access and schema initialization
|-- events/                  # Discord event handlers
|-- commands/
|   |-- admin/               # Moderation and server info
|   |-- ai/                  # Gemini and agent slash commands
|   |-- fun/                 # Fun interaction commands
|   `-- minecraft/           # Minecraft monitoring commands
`-- utils/
    |-- agent.ts             # Bot-to-agent HTTP relay
    |-- gemini.ts            # Gemini chat, cooldowns, usage tracking
    |-- minecraft.ts         # Minecraft status queries
    `-- slashCommands.ts     # Slash-command payload loading/registration
```

## Runtime Data

The app creates `data/` automatically. It is runtime state and must not be committed.

| Path | Purpose |
| --- | --- |
| `data/bot.db` | Guild config, Minecraft config, AI usage, and other bot state. |
| `data/chat-history/<guild_id>/<user_id>.db` | Per-guild, per-user Gemini chat history. |
| Docker volume `bot-data` | Persisted `/app/data` for the bot container. |
| Docker volume `agent-data` | Persisted `/app/data` for the agent container. |
| Docker volume `rollback-state` | Last-known-good image state for crash rollback. |

## Prerequisites

For local development:

- Bun
- Discord application with a bot token
- Discord application client ID
- Development guild ID
- Google Gemini API key

For Docker deployment:

- Docker Engine and Docker Compose
- Access to `ghcr.io/lani0516/discord-bot:latest`
- Access to `ghcr.io/lani0516/discord-agent-service:latest` if enabling the agent
- A GitHub token with `read:packages` if GHCR packages are private or watchtower must authenticate

For the coding agent:

- Running `discord-agent-service` image or repo
- DeepSeek API key
- GitHub fine-grained PAT scoped to this repo with Contents read/write and Pull requests read/write
- `INTERNAL_SECRET` shared by the bot and agent

## Local Setup

```bash
git clone https://github.com/Lani0516/discord-bot.git
cd discord-bot
bun install
cp .env.example .env
```

Fill `.env`:

```env
BOT_TOKEN=your-discord-bot-token
GEMINI_API_KEY=your-google-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
CLIENT_ID=your-discord-application-client-id
GUILD_ID=your-development-guild-id
AUTO_DEPLOY_COMMANDS=true
REQUIRE_COMMAND_DEPLOY=false

AGENT_SERVICE_URL=http://agent:8090
INTERNAL_SECRET=shared-random-secret
```

`AGENT_SERVICE_URL` and `INTERNAL_SECRET` are only required when the agent is enabled. For non-Docker local development against a locally running agent, use an address such as `http://127.0.0.1:8090`.

## Environment Variables

### Bot `.env`

| Variable | Required | Description |
| --- | --- | --- |
| `BOT_TOKEN` | Yes | Discord bot token. |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI chat. |
| `GEMINI_MODEL` | No | Gemini model name. Defaults to `gemini-2.5-flash`. |
| `CLIENT_ID` | Yes | Discord application/client ID for slash-command registration. |
| `GUILD_ID` | Yes | Guild where slash commands are registered. |
| `AUTO_DEPLOY_COMMANDS` | No | When not `false`, registers guild slash commands on startup. Docker deployments normally keep this enabled. |
| `REQUIRE_COMMAND_DEPLOY` | No | When `true`, startup fails if command registration fails. |
| `AGENT_SERVICE_URL` | Agent only | Agent service base URL. Docker Compose default is `http://agent:8090`. |
| `INTERNAL_SECRET` | Agent only | Shared bot-agent secret sent as `X-Internal-Secret`. Must match `.env.agent`. |
| `HEALTH_PORT` | Docker/default | Bot health and internal callback port. Compose sets `8080`. |
| `SMOKE_TEST` | CI only | `1` loads commands/events/db and exits without Discord login. |

### Agent `.env.agent`

Create `.env.agent` beside `docker-compose.yml` when enabling the agent:

```env
PORT=8090
INTERNAL_SECRET=shared-random-secret
BOT_INTERNAL_URL=http://bot:8080

DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-v4-flash

GITHUB_PAT=github-fine-grained-pat-for-discord-bot
GITHUB_REPO=Lani0516/discord-bot

LOCKOUT_HOURS=30
APPROVE_TIMEOUT_MS=600000
MERGE_TIMEOUT_MS=1800000

MAX_MODIFY_TASKS_PER_GUILD_PER_DAY=5
MAX_TASK_WALLCLOCK_MS=1800000
MAX_TASK_TOKENS=60000
```

Important notes:

- `INTERNAL_SECRET` must be identical in `.env` and `.env.agent`.
- `BOT_INTERNAL_URL` should be `http://bot:8080` under Docker Compose.
- Set `MAX_MODIFY_TASKS_PER_GUILD_PER_DAY=0` to temporarily disable the daily modify limit.
- `.env` and `.env.agent` are ignored by Git and must never be committed.

## Slash Commands

Register guild-scoped slash commands manually:

```bash
bun run deploy
```

The Docker deployment usually relies on:

```env
AUTO_DEPLOY_COMMANDS=true
```

That registers slash commands every time the bot starts. If command deployment must be strict, set `REQUIRE_COMMAND_DEPLOY=true`.

## Run Locally

```bash
bun start
```

Development mode with file watching:

```bash
bun run dev
```

Quality checks:

```bash
bun run typecheck
bun test
```

## Docker Deployment

`docker-compose.yml` defines:

| Service | Purpose |
| --- | --- |
| `bot` | Runs this Discord bot from `BOT_IMAGE` or `ghcr.io/lani0516/discord-bot:latest`. |
| `agent` | Runs `discord-agent-service` from `AGENT_IMAGE` or `ghcr.io/lani0516/discord-agent-service:latest`. Internal network only. |
| `watchtower` | Pulls new labeled images and redeploys them automatically. |
| `crash-monitor` | Watches the bot for crash loops or unhealthy state and rolls back to the last good image digest. |

### 1. Create env files

```bash
cp .env.example .env
```

Fill `.env`, then create `.env.agent` using the agent example above if the agent should run.

The default compose stack includes the `agent` service, so a full `docker compose up -d` requires `.env.agent`. For a bot-only deployment, start only the services you need, for example `docker compose up -d bot crash-monitor`.

If you want to pin images instead of using `latest`, add these to `.env`:

```env
BOT_IMAGE=ghcr.io/lani0516/discord-bot:<tag-or-digest>
AGENT_IMAGE=ghcr.io/lani0516/discord-agent-service:<tag-or-digest>
```

### 2. Configure GHCR access for Docker and watchtower

If the images are private, log in on the host:

```bash
docker login ghcr.io
```

Watchtower cannot read macOS keychain-backed Docker credentials from inside its container. Create a file-based config that contains a GitHub token with `read:packages`:

```bash
mkdir -p ~/.docker-watchtower
docker login ghcr.io --config ~/.docker-watchtower
chmod 600 ~/.docker-watchtower/config.json
```

The compose file mounts that file at `/config.json` for watchtower.

### 3. Start the stack

```bash
docker compose pull
docker compose up -d
```

Check status:

```bash
docker compose ps
docker logs --tail=100 discord-bot
docker logs --tail=100 discord-agent
```

Expected state:

- `discord-bot` is healthy after Discord login.
- `discord-agent` is healthy when `.env.agent` is valid.
- `watchtower` is running.
- `crash-monitor` is running.

### 4. Enable the bot in Discord

1. In the Discord Developer Portal, enable the Message Content Intent for the bot.
2. Invite the bot with the required scopes and permissions: `bot` and `applications.commands`.
3. Make sure the bot has permissions to read/send messages in the AI and agent channels.
4. Run `/set-ai-channel` for Gemini chat.
5. Run `/set-agent-channel` for coding-agent conversations.

### 5. Deploy updates

The normal production path is:

1. Merge to `main`.
2. GitHub Actions builds and pushes `ghcr.io/lani0516/discord-bot:latest`.
3. Watchtower detects the new image and recreates `discord-bot`.
4. The bot auto-registers slash commands on startup when `AUTO_DEPLOY_COMMANDS=true`.

The agent service follows the same image/watchtower pattern with `discord-agent`.

Manual refresh:

```bash
docker compose pull bot agent
docker compose up -d bot agent
```

Stop the stack:

```bash
docker compose down
```

Use this if you also want to delete persisted runtime data:

```bash
docker compose down -v
```

## Health and Operations

- Bot health endpoint inside the container: `http://127.0.0.1:8080/`
- Agent health endpoint inside the container: `http://127.0.0.1:8090/health`
- Bot internal callbacks used by the agent:
  - `POST /internal/reply`
  - `POST /internal/plan`
  - `POST /internal/mod-gate`
- Agent internal endpoints used by the bot:
  - `POST /ingest`
  - `POST /confirm`
  - `POST /gate`
  - `POST /stop`

All internal endpoints require the shared `X-Internal-Secret` header.

Useful operations:

```bash
docker compose ps
docker logs -f discord-bot
docker logs -f discord-agent
docker compose restart bot
docker compose restart agent
```

Agent guardrails:

- Restart cleanup marks interrupted queued/running/approval/merge/working tasks as `error`; it does not resume them.
- `/agent-stop task-id:<id>` relays to the agent `/stop` endpoint and marks the task cancelled when possible.
- Daily modify limits, wall-clock limits, token budgets, approval timeouts, and merge timeouts are configured in `.env.agent`.

## CI and Guardrails

The repository includes GitHub Actions for image builds and PR harness checks:

- Type checking and tests
- Docker build smoke test using `SMOKE_TEST=1`
- Heuristic security scan
- Protected-path checks for infrastructure and guardrail files

Protected infrastructure changes are intentionally harder to auto-merge. The coding agent should modify normal source files through PRs and moderator approvals, not bypass guardrails.

## Development Conventions

- Commands live in `src/commands/<category>/`.
- Every command exports `data` and `execute`.
- Events live in `src/events/`.
- Every event exports `name`, `execute`, and optionally `once`.
- The bot's default user-facing language is Traditional Chinese.
- Never commit `.env`, `.env.agent`, database files, or `data/`.

## License

MIT
