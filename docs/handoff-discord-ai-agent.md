# Handoff — Discord 自我修改 AI Agent

## 狀態
**M4（審批與懲罰）已實作，兩 PR 開啟待 merge + 端到端驗證。M3 已完成並 e2e 通過。**
- M4 PR：repo A **#24**（`feat/m4-mod-gate-buttons`）+ repo B **#5**（`feat/m4-approval-loop`）。先 merge #24（bot 側 dormant）再 merge #5（啟用）。#24 因動 `scripts/security-scan.sh` → protected-paths 紅 → admin merge。
- 本機全綠：repo A typecheck/smoke OK、`bun test` CI-clean（本機 ai_usage 測試因共用 dev db 累積列失敗，與 M4 無關）；repo B typecheck + `bun test` 36 pass + smoke OK。
- **尚未做**：兩 PR merge 後的端到端（merge 閘真按 [Merge] + lockout 真鎖）驗證。

**M3（動工 loop）完成且端到端驗證通過。自我修改 loop 全鏈打通。**
- repo A PR **#17**（bot 側確認按鈕）+ repo B PR **#3**（agent 動工核心）已 merge 進 main（#17 因縱深防禦 security-scan/protected-paths 紅，以 `--admin` 人工過閘）。
- **端到端驗證（2026-06-04，全綠）**：agent 頻道丟「新增 /ping 回 Pong」→ DeepSeek 分類 modify → 出計畫 + `[開始]/[取消]` 按鈕 → 點[開始] → worktree → 寫 `src/commands/fun/ping.ts` → push → 開 **PR #18** → harness 四 job **全綠**（quality/build-smoke/security-scan/protected-paths，src-only 無需人工過閘）→ 已 merge。Gemini `ai_channel_id` 路徑同時測試不受影響（回覆正常；模型自報 GPT-4 = 無害幻覺）。
- M0–M2 已 merge 進 main（兩 repo）。M2 期間 repo B 另補 CI + OpenRouter→DeepSeek 遷移（PR #2，已 merge）。
- 計畫文件：`~/.claude/plans/steady-shimmying-storm.md`（M3 設計與決策）。
- **watchtower 已修復（2026-06-04）**：換維護中 fork `nickfedor/watchtower:1.16.1`（PR #20）+ GHCR auth 改檔案式 config（PR #21）→ 自動部署鏈端到端驗證通過（merge→build-image→watchtower 自動 redeploy→bot healthy）。

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
本機 Docker 跑 bot + agent（皆 healthy，bot 連著 Discord `拉你#8459`）+ crash-monitor + watchtower。可 `docker compose down` 收工或保留。
本機 image 為 GHCR `:latest`（watchtower 自動 pull+redeploy，無需手動）。
**watchtower 已修（2026-06-04，PR #20+#21）**：原 `containrrr/watchtower`（2023 停更）用 Docker API v1.25 → 新 daemon（≥1.40）crash-loop（`client version 1.25 is too old`）。已換 `nickfedor/watchtower:1.16.1`（API v1.51 OK）。另：host `~/.docker/config.json` 用 `credsStore=osxkeychain`（token 在 keychain、容器讀不到）→ GHCR digest HEAD 403 → 改掛專用 `~/.docker-watchtower/config.json`（inline `read:packages` token，host-only）。端到端驗證：merge→build-image→watchtower `Found new image`→`updated=1`→bot healthy。

## 安全注意（已處理 / 待追）
- 使用者首次 `docker login` 曾把 classic PAT 明文塞進壞掉的 `~/.docker/config.json`，已備份+重置+正規重登；`*.bak.*` 已刪除、洩漏的 `read:packages` PAT 已 revoke 重發。
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
- `src/worker.ts`：建 task → `classifyAndReply`（DeepSeek 官方 API 單模型）→ `postReply` 回貼 bot `/internal/reply` → 標 done；fail 標 error + 回貼錯誤訊息。
- `src/parse.ts`（無 config 依賴，可測）解析模型 JSON `{intent,reply}`、去 code fence、intent 正規化、非 JSON 退回純文字。intent：`chat`/`question`/`modify_request`/`unknown`；`modify_request` 由 system prompt 引導回「動工 M3 才開放」。
- Dockerfile（slim Bun、非 root、healthcheck、`SMOKE_TEST`）；`config.ts` 啟動 require 必要 env。

## 驗證結果
- 兩 repo `bun run typecheck` + `bun test` 綠（repo A 14 pass；repo B queue FIFO/隔離 + parseReply 6 pass）、`SMOKE_TEST=1` 開機 OK。
- repo B 本機 HTTP 契約：`/health` 200、`/ingest` 無密鑰 401 / 壞 body 400 / 合法 202、未知路由 404。
- repo A CI（PR #15）：`quality` + `build-smoke` 綠；`security-scan` + `protected-paths` **故意紅**（M1 縱深防禦：新 `fetch`+`INTERNAL_SECRET` 讀取、改 `CLAUDE.md`+`docker-compose.yml`）→ 以人工 merge 過閘。**未弱化閘門**。`client.channels.fetch` 被當外連 = heuristic 誤報。
- **未做**：端到端（真 Discord + DeepSeek API key + 兩容器）「頻道唯讀回覆 + Gemini 不受影響」驗證 → 部署時補。

## M3 已實作（PR #17 + PR #3，均已 merge 進 main；security review 已補做）
設計 §8 M3 + 計畫 `~/.claude/plans/steady-shimmying-storm.md`。決策：確認用 **Discord 按鈕**（僅發話者可點）；APPROVE 路徑 **M3 直接擋**（審批留 M4）；分階段 PR。
- **repo A（#17）**：`POST /internal/plan`（貼計畫 + `[開始]/[取消]` 按鈕，customId `agent_<action>_<taskId>_<requesterId>`）；`interactionCreate` 按鈕處理（發話者驗證）→ `agentConfirm` 中繼到 agent `/confirm`。進度串流續用 `/internal/reply`。
- **repo B（#3）**：`paths.ts`（AUTO/APPROVE 分級）、`repo.ts`（clone+worktree，PAT 走 per-command `http.extraHeader`，不入 URL/log）、`tools.ts`（read/list/write[擋 APPROVE]/run_git[allowlist]/finish）、`github.ts`（開 PR + poll harness checks）、`confirm.ts`（確認 registry+timeout）、`agent-loop.ts`（tool loop maxSteps→commit→push→PR→等 CI→失敗回灌 maxFixRounds→回報，串流進度）。`worker.ts` modify 分支；`server.ts` `/confirm`；`config` 加 `GITHUB_PAT`/`GITHUB_REPO`；Dockerfile 裝 git。本機全綠（typecheck/26 tests/container smoke/docker build）。
- **security review 已補做（2026-06-05）**：M3 動工 loop 全面審查，findings 全修並上線。
  - repo A **PR #23**（已 admin-merge，過 security-scan heuristic 誤報）：`/internal/reply`+`/internal/plan` secret 比對改 `crypto.timingSafeEqual`（移除 timing side channel）。
  - repo B **PR #4**（已 merge）：[HIGH] `run_git` `rm`/`mv` 路徑操作數過 `classifyPath` → 不再能繞過 `write_file` 守衛刪/改受保護檔；[MED] `classifyPath` 改 case-insensitive（擋 `dockerfile`/`.GitHub/` 之類 case-fold 繞過）；[MED] `safePath` 用 realpath 解最近存在祖先 → 擋 worktree 內 symlink 逃逸；[LOW] `redact()` 加遮 base64 auth header；[LOW] `/ingest`+`/confirm` secret 改 `timingSafeEqual`。+1 test（rm/mv 守衛）→ 27 pass。
  - DeepSeek model 預設 `deepseek-v4-flash` **刻意保留**（官方 `deepseek-chat` API 2026-07-24 棄用）。

## M4 已實作（PR #24 + PR #5，待 merge；2026-06-05）
設計 §3/§8 M4 + 計畫 `~/.claude/plans/humble-rolling-quail.md`。決策：審批 = **loop 中即時核准 + PR 閘**；mod 身分 = **ManageGuild**；預算護欄留 M5。
- **APPROVE 拆兩級**（repo B `paths.ts`）：`APPROVE`＝`package.json`/`bun.lock`（CI protected-paths 不擋 → mod 核准後可合併）→ loop 中跑 mod 核准；`DENY`＝infra/guardrails（`.github`/`scripts`/Dockerfile/compose/守則 md/`.env*`/traversal）→ CI 永遠硬擋 → `write_file` 直接拒（不發無效 mod ping）。
- **mid-loop 核准**：`write_file` 命中 APPROVE → `gate.ts` registry + bot `/internal/mod-gate` 貼 `[核准]/[拒絕]`（ManageGuild）→ 核准才寫；拒絕 → 略過 + 鎖發話者；逾時 → 略過不鎖。
- **merge 閘**：CI 全綠後 agent 不再止步，改貼 `[Merge]/[Reject]`（ManageGuild）。Merge → `mergePR`（squash，觸發 build-image→watchtower）；Reject → `closePR` + 鎖發話者 30h；逾時 → PR 保留不鎖。
- **lockout**：repo B `db.ts` `lockouts` 表（PK user+guild，expiry）。ingest 時對 `modify_request` 先查（chat/question 不受影響）。僅 mod 明示 deny 觸發；不做「命中 DENY 自動鎖」（避免誤鎖）。
- **security-scan 降級**（repo A `scripts/security-scan.sh`）：flag-only `exit 0`（仍印旗標），把關交 merge 閘 mod。`protected-paths.sh` 維持硬擋（縱深防禦不弱化）。
- bot 中繼：`interactionCreate` 加 `agentapprove_*`/`agentmerge_*`（ManageGuild 檢查）→ `agentModGate` → agent `/gate`。env 新增（選用，有預設）：`LOCKOUT_HOURS`/`APPROVE_TIMEOUT_MS`/`MERGE_TIMEOUT_MS`。
- **已知限制（M5）**：mod 閘等待期間該 guild FIFO 阻塞（≤30min）；gate registry 在記憶體，agent 重啟 → 等待中 task 卡住（同 M3 confirm）。

## 下一步
1. ✓ ~~修 watchtower~~ 已完成（2026-06-04，PR #20+#21）。自動部署鏈恢復。
2. **M4 收尾**：merge #24（admin，因 protected-paths）→ merge #5 → 端到端驗證：(a) `/pong` 需求 → PR + CI 綠 → ManageGuild 帳號按 [Merge] → GitHub merge → watchtower 部署；(b) 改 `package.json` → [拒絕] → 略過 + 發話者鎖 30h → 再丟 modify_request 被拒。確認 Gemini 頻道 + chat/question 不受影響。
3. **M5（成本護欄與營運）**：每 guild 每日 task/花費上限、每 task token+wallclock 預算、`[Stop]`/`/agent stop` kill switch + 清 worktree、重啟 resume / 乾淨失敗通知。見設計 §8。
4. ✓ ~~`code-review` / `security-review`~~ 已完成（2026-06-05，repo A #23 + repo B #4）。M3 動工 loop findings 全修上線。
5. M4 計畫文件：`~/.claude/plans/humble-rolling-quail.md`。

## 待人類決定/動作
- ✓ `.env.agent` 已建（`INTERNAL_SECRET` 兩邊一致、`DEEPSEEK_API_KEY`、`GITHUB_PAT`、`GITHUB_REPO=Lani0516/discord-bot`）；bot `.env` 已對齊 `AGENT_SERVICE_URL`+`INTERNAL_SECRET`。security 已掃：兩 repo 無密鑰外洩、PAT 一致、gitignore OK。
- ✓ 洩漏的 `read:packages` classic PAT 已 revoke 重發；watchtower GHCR auth 改用 `~/.docker-watchtower/config.json`（檔案式 inline token）。

## 慣例（重要）
- **改動前先開 branch，完工 PR→merge，絕不直接 commit main**（main→CI build→自動部署）。
- handoff 文件寫進 `./docs/`（非 /tmp）。
- 回覆**繁體中文**；CAVEMAN MODE（wenyan-ultra）精簡，程式/commit/security 寫正常。
- 環境：macOS、fish shell、Bun runtime。

## 建議 skills
- `/oh-my-claudecode:executor`（model=opus）：實作 M4–M5。
- `/grill-me`：若 M4 審批流判準（哪些改動要 mod 核准、懲罰機制）要再釐清。
