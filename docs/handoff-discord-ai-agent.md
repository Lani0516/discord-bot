# Handoff — Discord 自我修改 AI Agent

## 狀態
**M2（Bot↔Agent 骨架，唯讀）完成且兩 repo 已 merge 進 main。** 進行中：可開始 M3。
尚未端到端部署驗證（需 `.env.agent` 密鑰 + 跑兩容器）。

## 唯一真相來源（勿重複）
- 設計：`docs/ai-agent-design.md`（架構、流程、審批、安全、§8 build order M0–M5）。
- M0 runbook：`docs/ai-agent-m0.md`（產物清單、人工步驟、驗證清單）。
- 程式碼/決策細節：看 git log 與各 PR diff（見下）。

## 專案背景
`discord-bot` = repo A（Bun + TS + discord.js v14 + Gemini 閒聊 + SQLite）。
目標：頻道內對話一個 coding agent，能自建 worktree+branch 改機器人功能，
經 CI harness + 審批後自動部署更新自己。詳見設計文件。

## M0 已完成（PR #1–#5，均已 merge 進 main）
- #1 地基：`Dockerfile`(slim Bun, 非 root, healthcheck)、`src/index.ts` 加 `SMOKE_TEST=1` dry-boot + `Bun.serve` health 埠 8080、CI `.github/workflows/build-image.yml`(build→smoke→push GHCR sha+latest)、`docker-compose.yml`(bot+watchtower+crash-monitor)、`scripts/crash-monitor.sh`。
- #2 GHCR tag 須小寫（`${GITHUB_REPOSITORY,,}`）。
- #3 image multi-arch amd64+arm64。
- #4 crash-monitor 用 `docker inspect --format` 讀 state/health（grep JSON 會抓錯 `Status`）。
- #5 rollback 改存 **RepoDigest**（`repo@sha256`）+ 缺失先 `docker pull`（裸 image ID 會被 GC → rollback 炸）。

## 本機驗證結果（全綠）
- A：smoke-boot + `docker run` 開機 OK。
- multi-arch arm64 pull OK；`docker compose up` 三容器，bot **healthy**、登入 Discord `拉你#8459`、health 埠 `200 ok`。
- **C（核心）**：build 開機即 crash 的 image 蓋本機 `:latest` → bot crash-loop → crash-monitor 偵測（+7 restarts）→ pull good digest → 重建 → bot 回 `1501...` healthy。
- B（watchtower 從 CI 自動更新）未單獨測；watchtower 在跑。

## 環境現況
本機 Docker 三容器仍在跑（bot 連著 Discord）。可 `docker compose down` 收工或保留。
本機 `:latest` 已還原為 registry good image；測試用壞 image 已刪。

## 安全注意（已處理 / 待追）
- 使用者首次 `docker login` 曾把 classic PAT 明文塞進壞掉的 `~/.docker/config.json`，已備份+重置+正規重登。
  **待辦**：刪 `~/.docker/config.json.bak.*`（仍含明文 token），並建議到 GitHub revoke 該 `read:packages` PAT 重發。
- 勿提交 `.env` 等密鑰。token/key 只進 env。

## M1 已完成（PR #7，已 merge 進 main）
- `.github/workflows/harness.yml`（trigger: `pull_request` → main），4 job：
  - **quality**：`bun install --frozen-lockfile` → `bun run typecheck` → `bun test`。
  - **build-smoke**：docker build(load，不 push) → `docker run -e SMOKE_TEST=1`（假 env，不登入 Discord）。
  - **security-scan**：diff 掃描 → 新相依(package.json/bun.lock)、對外網路(fetch/http/axios/WebSocket/net)、讀 `*SECRET|TOKEN|KEY|PASSWORD` → 命中 exit 1。
  - **protected-paths**：diff 動到 infra/CI/guardrails(`.github/**`、`scripts/**`、Dockerfile、docker-compose、AGENTS/CLAUDE/CONTEXT.md、`.env*`，但放行 `.env.example`) → exit 1。
- 掃描邏輯抽到 `scripts/security-scan.sh` + `scripts/protected-paths.sh`（本機可跑：`scripts/<x>.sh <base-ref>`，bash 3.2 相容，無 globstar）。

## CI 驗證結果（全綠）
- protected-paths fail：PR #7 自身動 `.github`+`scripts` → 紅（縱深防禦生效；infra 變更須人類 merge，本 PR 即以人工 merge 過閘）。
- 反向 demo（已開 → 驗證 → 關，未 merge）：
  - PR #12 src-only → 4 job 全綠。
  - PR #13 `fetch()`+`process.env.*TOKEN` → security-scan 紅、其餘綠。
- merge #7 → `build-image` on main success（部署鏈正常）。

## 已知缺口 / 待追（M1）
- **lint 未做**：repo 無 eslint/prettier/biome 設定；本里程碑以 typecheck 當品質閘，lint 留待後續（加設定恐波及既有檔，刻意縮範圍）。
- security-scan 為 heuristic + hard-fail（M1 無審批流）；M4 接審批後應改為「flag → mod 核准」而非單純 fail。

## M2 已完成（repo A PR #15 + repo B PR #1，均已 merge 進 main）
**repo A（bot 側，PR #15）**
- `/set-agent-channel`（ManageGuild）→ 存 `agent_channel_id` 進 `server_config`（generic KV，無 schema 變更）。
- `events/messageCreate.ts`：agent 頻道訊息 → `utils/agent.ts` `forwardToAgent` → `POST {AGENT_SERVICE_URL}/ingest`（`X-Internal-Secret`）。Gemini `ai_channel_id` 路徑完全不動，agent 頻道優先。
- `index.ts` health server 擴充 `POST /internal/reply`（驗 `INTERNAL_SECRET` → `client.channels.fetch` → 分段 send，2000 字切塊）。
- env：`AGENT_SERVICE_URL`、`INTERNAL_SECRET`（`.env.example`/`CLAUDE.md`）；`docker-compose.yml` 加 `agent` 服務（internal-only、無對外埠、`env_file: .env.agent`、healthcheck `/health`、watchtower label）；`.gitignore` 加 `.env.agent`。

**repo B（`../discord-agent-service`，PR #1）= agent-service**
- `src/server.ts` Bun.serve 埠 8090：`GET /health`、`POST /ingest`（驗密鑰 + payload 驗證 → 入列 → 202）。
- `src/queue.ts` per-guild 序列 FIFO（同 guild 一次一個、跨 guild 並行、單 job fail 不毒化該 guild 佇列）。
- `src/db.ts` bun:sqlite `tasks` 狀態表（queued/running/done/error + intent）。
- `src/worker.ts`：建 task → `classifyAndReply`（openrouter 單模型）→ `postReply` 回貼 bot `/internal/reply` → 標 done；fail 標 error + 回貼錯誤訊息。
- `src/parse.ts`（無 config 依賴，可測）解析模型 JSON `{intent,reply}`、去 code fence、intent 正規化、非 JSON 退回純文字。intent：`chat`/`question`/`modify_request`/`unknown`；`modify_request` 由 system prompt 引導回「動工 M3 才開放」。
- Dockerfile（slim Bun、非 root、healthcheck、`SMOKE_TEST`）；`config.ts` 啟動 require 必要 env。

## 驗證結果
- 兩 repo `bun run typecheck` + `bun test` 綠（repo A 14 pass；repo B queue FIFO/隔離 + parseReply 6 pass）、`SMOKE_TEST=1` 開機 OK。
- repo B 本機 HTTP 契約：`/health` 200、`/ingest` 無密鑰 401 / 壞 body 400 / 合法 202、未知路由 404。
- repo A CI（PR #15）：`quality` + `build-smoke` 綠；`security-scan` + `protected-paths` **故意紅**（M1 縱深防禦：新 `fetch`+`INTERNAL_SECRET` 讀取、改 `CLAUDE.md`+`docker-compose.yml`）→ 以人工 merge 過閘。**未弱化閘門**。`client.channels.fetch` 被當外連 = heuristic 誤報。
- **未做**：端到端（真 Discord + openrouter key + 兩容器）「頻道唯讀回覆 + Gemini 不受影響」驗證 → 部署時補。

## 下一步：M3（動工 loop：worktree + write/git，push 才執行）
設計 §8 M3：typed 工具 `read_file`/`write_file`(路徑分級 AUTO/APPROVE)/`git`(branch/commit/push/PR)；計畫 + `[Start]/[Cancel]`(發話者確認) → worktree + branch → loop → push → 讀 CI → 失敗修(迭代上限) → 過則開 PR；串流「Cur. working」進度到頻道。
驗證：丟簡單需求（如新 `/ping`），agent 開 PR 且 CI 全綠。
**先決**：repo B 需 agent 用 fine-grained PAT（repo A only、`Contents:RW`+`Pull requests:RW`）→ 請簽發、只進 agent env。

## 待人類決定/動作
- **部署密鑰**：建 `.env.agent`（`INTERNAL_SECRET` 兩邊一致、`OPENROUTER_API_KEY`、`OPENROUTER_MODEL`、`BOT_INTERNAL_URL=http://bot:8080`）；bot `.env` 加 `AGENT_SERVICE_URL=http://agent:8090` + 同一 `INTERNAL_SECRET`。`.env.agent` 已 gitignore，勿提交。
- **repo B CI**：repo B 目前無 harness/build-image workflow（M2 未加）；agent 服務要進 watchtower 自動部署鏈，需比照 repo A 加 build→push GHCR。M3 前補。
- **端到端驗證**：deploy 兩容器 + 真 openrouter key → 設 agent 頻道 → 測唯讀回覆 + Gemini 不受影響。
- M3 用 fine-grained PAT（repo A only, `Contents:RW`+`Pull requests:RW`）→ 請簽發。

## 慣例（重要）
- **改動前先開 branch，完工 PR→merge，絕不直接 commit main**（main→CI build→自動部署）。
- handoff 文件寫進 `./docs/`（非 /tmp）。
- 回覆**繁體中文**；CAVEMAN MODE（wenyan-ultra）精簡，程式/commit/security 寫正常。
- 環境：macOS、fish shell、Bun runtime。

## 建議 skills
- `/oh-my-claudecode:executor`（model=opus）：實作 M2–M5。
- `/tdd`：M2 agent 邏輯（意圖分類 / 內部 API）適合測試先行。
- `code-review` / `security-review`：M2 內部 API + 共享密鑰驗證立起後過一次。
- `/grill-me`：若 M2 bot↔agent 協定或意圖分類判準要再釐清。
