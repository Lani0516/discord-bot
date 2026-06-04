# Handoff — Discord 自我修改 AI Agent

## 狀態
**M0（地基與隔離）完成且本機端到端驗證通過。** 進行中：可開始 M1。

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

## 下一步：M1（CI harness，無 AI）
設計文件 §8 M1：repo A 加 GitHub Actions lint/typecheck/test/build/smoke-boot(假 token) + security scan(diff: 新相依/對外網路/讀 `*SECRET|TOKEN`) + protected-path 複查 job。
驗證：開幾個 PR 分別觸發各 job pass/fail。
注意現有 repo 僅 `bun test tests/database.test.ts` 一個測試、`bun run typecheck`、無 lint 設定。

## 待人類決定/動作
- repo B 空殼已建於 `../discord-agent-service`（含 README/AGENTS.md/.gitignore，自有 git，無 remote）。要 remote：`gh repo create discord-agent-service --private` + push。
- agent 用的 fine-grained PAT（repo A only, `Contents:RW`+`Pull requests:RW`）M2 才需。

## 慣例（重要）
- **改動前先開 branch，完工 PR→merge，絕不直接 commit main**（main→CI build→自動部署）。
- handoff 文件寫進 `./docs/`（非 /tmp）。
- 回覆**繁體中文**；CAVEMAN MODE（wenyan-ultra）精簡，程式/commit/security 寫正常。
- 環境：macOS、fish shell、Bun runtime。

## 建議 skills
- `/tdd`：M1 加測試 / harness job 適合測試先行。
- `/oh-my-claudecode:executor`（model=opus）：實作 M1–M5。
- `code-review` / `security-review`：M1 security scan + protected-path 立起後過一次。
- `/grill-me`：若 M1 各 job 的 pass/fail 判準要再釐清。
