# Handoff — Discord 自我修改 AI Agent

## 狀態
**M1（CI harness，無 AI）完成且在 CI 端到端驗證通過。** 進行中：可開始 M2。

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

## 下一步：M2（Bot↔Agent 骨架，無動工能力）
設計 §8 M2：agent-service(HTTP + 共享密鑰 + 每 guild FIFO queue + DB 狀態表)；bot 加 `/set-agent-channel`+`agent_channel_id`+轉訊息內部 API；agent 先只做分類意圖 + 唯讀回覆(openrouter 單模型)。
驗證：頻道閒聊/問答正確唯讀回覆；既有 Gemini 頻道不受影響。

## 待人類決定/動作
- repo B 空殼已建於 `../discord-agent-service`（含 README/AGENTS.md/.gitignore，自有 git，無 remote）。要 remote：`gh repo create discord-agent-service --private` + push。
- agent 用的 fine-grained PAT（repo A only, `Contents:RW`+`Pull requests:RW`）M2 才需 → 請簽發。
- openrouter key（M2 agent 用）→ 請備妥，只進 agent env。

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
