# Discord Bot

多功能 Discord 機器人，使用 Bun、TypeScript 與 discord.js v14 開發。功能包含 Slash Command 伺服器管理、趣味互動、Google Gemini AI 聊天、Minecraft Java 伺服器狀態監控，以及可選用的自我修改 coding agent。

英文版文件請看 [README.md](README.md)。

## 功能

### 伺服器管理

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/ban` | 封鎖指定成員，可選擇刪除最近 0 到 7 天的訊息並記錄原因。 | 封鎖成員 |
| `/kick` | 踢出指定成員並可填寫原因。 | 踢出成員 |
| `/mute` | 對指定成員設定 1 到 10080 分鐘的逾時禁言。 | 管理成員 |
| `/unmute` | 解除指定成員的禁言狀態。 | 管理成員 |
| `/purge` | 批量刪除頻道訊息，可限定只刪除特定成員的訊息。 | 管理訊息 |
| `/serverinfo` | 顯示目前 Discord 伺服器資訊。 | 無 |
| `/userinfo` | 顯示指定使用者或自己的帳號與伺服器資訊。 | 無 |

### AI 聊天

Gemini 聊天可透過指定頻道自動回覆，也可用提及 bot 的方式觸發。系統會保存每位使用者在每個伺服器的近期對話紀錄，讓回覆能參考上下文。

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/set-ai-channel` | 設定或清除 AI 自動回覆頻道。 | 管理伺服器 |
| `/set-system-prompt` | 設定此伺服器使用的 Gemini 系統提示。 | 管理伺服器 |
| `/view-system-prompt` | 查看目前的 Gemini 系統提示。 | 無 |
| `/clear-history` | 清除自己的 AI 對話紀錄。 | 無 |
| `/ai-usage` | 查看本月 Gemini 用量與預估成本。 | 管理伺服器 |

### Coding Agent

Coding agent 是可選功能，獨立跑在 `discord-agent-service` 容器中。Bot 只負責 Discord 訊息與按鈕中繼；agent service 負責 DeepSeek、GitHub PR flow、task 狀態、worktree、審批與營運護欄。

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/set-agent-channel` | 設定或清除 coding agent 對話頻道。 | 管理伺服器 |
| `/agent-stop` | 依 task id 停止 queued、running、等待確認、等待審批、等待 merge 或 working 的 agent task。 | 管理伺服器 |

修改需求流程：

1. 使用者在 agent 頻道提出需求。
2. Bot 將訊息轉送到 `discord-agent-service`。
3. Agent 分類需求、貼出計畫，等待發話者按「開始」或「取消」。
4. 開始後 agent 建立 branch/worktree、修改 repo A（`discord-bot`）、開 GitHub PR、等待 CI，再請有管理伺服器權限的管理員按 Merge 或 Reject。
5. 管理員 merge 後，agent 會輪詢 bot 的 `GET /version` endpoint，直到它回傳已 merge 的 commit SHA，接著在 agent 頻道貼出 `🚀 已上線` 確認，讓發話者知道 redeploy 真的完成。
6. Infra 與 guardrail 路徑維持保護；相依套件變更需要管理員核准後才會寫入。

#### 部署確認

Bot 會在 build image 時把 commit 烤進 `BUILD_SHA`，並由 `GET /version` 提供。Post-merge redeploy 完成時，watchtower 以新 image 重建 bot container，`/version` 便開始回傳新的 SHA。Agent 在 merge 後輪詢此 endpoint，當執行中的 bot 回報預期 SHA 即貼出 `🚀 已上線`；若 redeploy 未在時限內完成則貼出 timeout 提示。這把「PR 已 merge」轉成使用者看得到的「你的變更已上線」訊號。

### 趣味互動

| 指令 | 用途 |
| --- | --- |
| `/8ball` | 向神奇 8 號球提問。 |
| `/coinflip` | 擲硬幣。 |
| `/dice` | 擲一顆或多顆骰子，可設定面數與數量。 |
| `/poll` | 建立最多五個選項的投票。 |
| `/ping` / `/pong` | 簡單回覆指令，用於 smoke check 與範例。 |

### Minecraft 伺服器監控

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/mc-setup` | 設定要監控的 Minecraft Java 伺服器、顯示頻道、連接埠與更新間隔。 | 管理伺服器 |
| `/mc-status` | 查詢已綁定伺服器或任意指定伺服器。 | 無 |
| `/mc-remove` | 移除目前 Discord 伺服器的 Minecraft 監控設定。 | 管理伺服器 |

## 技術架構

- 執行環境：Bun
- 語言：TypeScript，ESM modules
- Discord SDK：discord.js v14
- AI 聊天：Google Gemini API
- Coding agent：獨立 `discord-agent-service` 容器，使用 DeepSeek 與 GitHub PR
- 資料庫：SQLite
- Minecraft 查詢：`minecraft-server-util`

```text
src/
├── index.ts                 # Bot 入口、health server、agent internal callback
├── deploy-commands.ts       # Guild slash-command 註冊
├── database.ts              # SQLite 存取與 schema 初始化
├── events/                  # Discord event handlers
├── commands/
│   ├── admin/               # 管理指令
│   ├── ai/                  # Gemini 與 agent 指令
│   ├── fun/                 # 趣味互動
│   └── minecraft/           # Minecraft 監控
└── utils/
    ├── agent.ts             # Bot 到 agent 的 HTTP relay
    ├── gemini.ts            # Gemini 對話、冷卻、用量紀錄
    ├── minecraft.ts         # Minecraft 狀態查詢
    └── slashCommands.ts     # Slash-command 載入與註冊
```

## 執行期資料

專案會自動建立 `data/`。這是執行期狀態，不應提交。

| 路徑 | 說明 |
| --- | --- |
| `data/bot.db` | 伺服器設定、Minecraft 設定、AI 用量與其他 bot 狀態。 |
| `data/chat-history/<guild_id>/<user_id>.db` | 每個伺服器、每位使用者的 Gemini 對話紀錄。 |
| Docker volume `bot-data` | bot container 的 `/app/data`。 |
| Docker volume `agent-data` | agent container 的 `/app/data`。 |
| Docker volume `rollback-state` | crash rollback 的 last-known-good image 狀態。 |

## 安裝需求

本機開發需要：

- Bun
- Discord application 與 bot token
- Discord application client ID
- 開發用 guild ID
- Google Gemini API key

Docker 部署需要：

- Docker Engine 與 Docker Compose
- 可 pull `ghcr.io/lani0516/discord-bot:latest`
- 若啟用 agent，需可 pull `ghcr.io/lani0516/discord-agent-service:latest`
- 若 GHCR package 是 private 或 watchtower 需要驗證，需 GitHub `read:packages` token

Coding agent 另需：

- `discord-agent-service` image 或 repo
- DeepSeek API key
- GitHub fine-grained PAT，限此 repo，權限至少 Contents read/write 與 Pull requests read/write
- Bot 與 agent 共用的 `INTERNAL_SECRET`

## 本機設定

```bash
git clone https://github.com/Lani0516/discord-bot.git
cd discord-bot
bun install
cp .env.example .env
```

填寫 `.env`：

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

`AGENT_SERVICE_URL` 與 `INTERNAL_SECRET` 只有啟用 agent 時必填。本機非 Docker 跑 agent 時可改成 `http://127.0.0.1:8090`。

## 環境變數

### Bot `.env`

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `BOT_TOKEN` | 是 | Discord bot token。 |
| `GEMINI_API_KEY` | 是 | Google Gemini API key。 |
| `GEMINI_MODEL` | 否 | Gemini model 名稱；未設定時預設為 `gemini-2.5-flash`。 |
| `CLIENT_ID` | 是 | Discord application/client ID，用於註冊 slash commands。 |
| `GUILD_ID` | 是 | Slash commands 註冊目標 guild。 |
| `AUTO_DEPLOY_COMMANDS` | 否 | 不是 `false` 時，啟動時會註冊 guild slash commands。Docker 部署通常保持啟用。 |
| `REQUIRE_COMMAND_DEPLOY` | 否 | `true` 時，command 註冊失敗會讓啟動失敗。 |
| `AGENT_SERVICE_URL` | agent 功能需要 | Agent service base URL；Docker Compose 預設 `http://agent:8090`。 |
| `INTERNAL_SECRET` | agent 功能需要 | Bot 與 agent 共用密鑰，透過 `X-Internal-Secret` 傳送。必須與 `.env.agent` 一致。 |
| `HEALTH_PORT` | Docker/預設 | Bot health 與 internal callback port；Compose 設為 `8080`。 |
| `BUILD_SHA` | CI/Docker | Build 時烤進 image 的 git commit SHA，由 `GET /version` 提供。Image build 會自動設定;本機執行可不設(此時 `/version` 回傳 `unknown`)。 |
| `SMOKE_TEST` | CI 用 | `1` 時只載入 commands/events/db 後退出，不登入 Discord。 |

### Agent `.env.agent`

啟用 agent 時，在 `docker-compose.yml` 旁建立 `.env.agent`：

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

注意：

- `.env` 與 `.env.agent` 的 `INTERNAL_SECRET` 必須完全相同。
- Docker Compose 下 `BOT_INTERNAL_URL` 應為 `http://bot:8080`。
- `MAX_MODIFY_TASKS_PER_GUILD_PER_DAY=0` 可暫時關閉每日 modify 限制。
- `.env` 與 `.env.agent` 已被 Git ignore，不能提交。

## Slash Commands

手動註冊 guild-scoped slash commands：

```bash
bun run deploy
```

Docker 部署通常靠下列設定在 bot 啟動時自動註冊：

```env
AUTO_DEPLOY_COMMANDS=true
```

若 command 註冊失敗必須讓部署失敗，設定：

```env
REQUIRE_COMMAND_DEPLOY=true
```

## 本機執行

```bash
bun start
```

開發模式：

```bash
bun run dev
```

檢查：

```bash
bun run typecheck
bun test
```

## Docker 部署

`docker-compose.yml` 定義四個服務：

| Service | 用途 |
| --- | --- |
| `bot` | 從 `BOT_IMAGE` 或 `ghcr.io/lani0516/discord-bot:latest` 執行此 Discord bot。 |
| `agent` | 從 `AGENT_IMAGE` 或 `ghcr.io/lani0516/discord-agent-service:latest` 執行 agent。只在 Docker internal network 中使用，不對外開 port。 |
| `watchtower` | 自動 pull 新 image 並 redeploy 有 label 的 container。 |
| `crash-monitor` | 監控 bot crash loop 或 unhealthy，回滾到 last good image digest。 |

### 1. 建立 env files

```bash
cp .env.example .env
```

填好 `.env`。若啟用 agent，再依上方範例建立 `.env.agent`。

預設 compose stack 包含 `agent` service，因此完整執行 `docker compose up -d` 時需要 `.env.agent`。若只要跑 bot，可只啟動需要的服務，例如 `docker compose up -d bot crash-monitor`。

若要固定 image，不使用 `latest`，可在 `.env` 加：

```env
BOT_IMAGE=ghcr.io/lani0516/discord-bot:<tag-or-digest>
AGENT_IMAGE=ghcr.io/lani0516/discord-agent-service:<tag-or-digest>
```

### 2. 設定 GHCR 與 watchtower 權限

若 image 是 private，host 先登入 GHCR：

```bash
docker login ghcr.io
```

macOS 的 Docker credential 常存在 keychain，watchtower container 讀不到。因此需要建立一份 file-based config，token 需有 `read:packages`：

```bash
mkdir -p ~/.docker-watchtower
docker login ghcr.io --config ~/.docker-watchtower
chmod 600 ~/.docker-watchtower/config.json
```

Compose 會把此檔案掛到 watchtower 的 `/config.json`。

### 3. 啟動 stack

```bash
docker compose pull
docker compose up -d
```

檢查狀態：

```bash
docker compose ps
docker logs --tail=100 discord-bot
docker logs --tail=100 discord-agent
```

預期：

- `discord-bot` 登入 Discord 後為 healthy。
- `.env.agent` 正確時，`discord-agent` 為 healthy。
- `watchtower` running。
- `crash-monitor` running。

### 4. Discord 啟用

1. 在 Discord Developer Portal 啟用 Message Content Intent。
2. 邀請 bot，scope 至少包含 `bot` 與 `applications.commands`。
3. 確認 bot 在 AI 與 agent 頻道有讀取、傳送訊息權限。
4. 用 `/set-ai-channel` 設定 Gemini 聊天頻道。
5. 用 `/set-agent-channel` 設定 coding agent 頻道。

### 5. 部署更新

正式部署流程：

1. Merge 到 `main`。
2. GitHub Actions build 並 push `ghcr.io/lani0516/discord-bot:latest`。
3. Watchtower 偵測新 image 並重建 `discord-bot`。
4. `AUTO_DEPLOY_COMMANDS=true` 時，bot 啟動後自動註冊 slash commands。

Agent service 也使用相同的 image/watchtower 部署模式。

手動更新：

```bash
docker compose pull bot agent
docker compose up -d bot agent
```

停止：

```bash
docker compose down
```

若也要刪除 persisted runtime data：

```bash
docker compose down -v
```

## Health 與營運

- Bot container 內 health endpoint：`http://127.0.0.1:8080/`
- Bot container 內 build 版本 endpoint：`http://127.0.0.1:8080/version`(回傳烤進的 `BUILD_SHA`,未設定時回 `unknown`)
- Agent container 內 health endpoint：`http://127.0.0.1:8090/health`
- Agent 會呼叫的 bot internal callbacks：
  - `POST /internal/reply`
  - `POST /internal/plan`
  - `POST /internal/mod-gate`
- Bot 會呼叫的 agent internal endpoints：
  - `POST /ingest`
  - `POST /confirm`
  - `POST /gate`
  - `POST /stop`

所有 internal endpoints 都需要共用的 `X-Internal-Secret` header。

常用指令：

```bash
docker compose ps
docker logs -f discord-bot
docker logs -f discord-agent
docker compose restart bot
docker compose restart agent
```

Agent 護欄：

- Agent 重啟時會將 interrupted queued/running/approval/merge/working tasks 標為 `error`，目前不 resume。
- `/agent-stop task-id:<id>` 會轉送到 agent `/stop`，可取消可停止的 task。
- 每日 modify limit、wall-clock limit、token budget、approval timeout、merge timeout 都在 `.env.agent` 設定。

## CI 與 Guardrails

Repo 內含 GitHub Actions：

- Type check 與 tests
- `SMOKE_TEST=1` Docker build smoke test
- Heuristic security scan
- Protected-path checks，保護 infra 與 guardrail files

Infra 變更刻意較難自動合併。Coding agent 應透過 PR 與管理員審批修改一般 source files，不應繞過 guardrails。

## 開發慣例

- 指令放在 `src/commands/<category>/`。
- 每個 command 匯出 `data` 與 `execute`。
- Events 放在 `src/events/`。
- 每個 event 匯出 `name`、`execute`，可選 `once`。
- Bot 預設使用繁體中文回覆。
- 不要提交 `.env`、`.env.agent`、database files 或 `data/`。

## 授權

MIT
