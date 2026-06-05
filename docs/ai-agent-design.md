# Discord 自我修改 AI Agent — 設計文件

讓使用者在指定 Discord 頻道直接對話一個 coding agent。agent 接收訊息，
判斷意圖；若是「修改/新增機器人功能」的請求，便開 worktree + 新 branch 自行動工，
經過層層 harness 與審批後，將變更合併並讓機器人自動部署更新自己。

---

## 1. 架構總覽

```
[ Discord ]
   │  使用者在 agent_channel 發訊息
   ▼
[ Bot container ]  ← 只持有 Discord token（thin，slim image）
   │  events (HTTP)            ▲  回貼訊息/按鈕 (HTTP + 共享密鑰)
   ▼                           │
[ Agent service ]  ← 長駐、獨立。持有 GitHub token + DeepSeek API key
   │  - 單一便宜且支援 tool-calling 的模型（env 設定）
   │  - 每 guild 序列 FIFO queue，同時只跑 1 個 task
   │  - 每步驟狀態寫入 DB，重啟時中斷 task 乾淨失敗
   │  - 工具：read / write / git（無 bash、無本機執行）
   │  - 工作區：git worktree，branch = feat/<taskId>，checkout 自 REPO A
   ▼
[ Repo A: discord-bot ]  ← agent 推 branch + 開 PR（token 權限只限此 repo）
   │  push branch
   ▼
[ GitHub CI ]  ← 所有「執行」都在這跑：lint、typecheck、test、build、
   │             security scan、protected-path 複查、smoke-boot
   │  全綠 + 點 [Merge]
   ▼
[ merge main ] → CI build image:sha → [ watchtower ] → 重建 bot container
                                                          （rollback = 前一個 tag）

[ Repo B: agent-service + guardrails ]  ← agent 零權限，只有人類能改
```

### 核心決策
| 項目 | 決定 |
|---|---|
| Agent 引擎 | 自建 loop（DeepSeek 官方 API + 自訂工具 + 自訂 harness） |
| 模型 | 單一便宜可靠的 tool-calling 模型，env 設定，無 fallback；預設使用 `deepseek-v4-flash` |
| 隔離 | git worktree + branch，PR-gated |
| 部署 | Docker + watchtower/CI，rollback = 前一 image tag |
| Agent 執行位置 | 獨立長駐 service（不隨 bot 部署被殺；重啟時中斷 task 乾淨標 error） |
| 工具面 | 僅 typed 工具 read/write/git，**完全無 bash** |
| 自我保護 | **雙 repo 物理隔離**，agent 碰不到自己的 guardrails |
| 通訊 | Bot 獨占 Discord token，bot↔agent 走內部 HTTP |
| 頻道 | 新增 `agent_channel_id`，既有 Gemini 閒聊頻道不動 |

---

## 2. 單則訊息流程

1. `agent_channel` 收到訊息 → bot 轉給 agent。
2. 先檢查發話者是否在 30h lockout。agent **分類意圖**：
   - 閒聊 / 問題 → 唯讀回覆（可讀 repo，不動工）
   - 功能 / 修 bug → 貼出簡短計畫 + `[Start] / [Cancel]`
3. 發話者按 Start → 建 worktree + branch，開始 loop；持續串流「Cur. working」進度。
4. agent 以 `write_file` 改檔，依路徑分級：
   - **AUTO（自動進行）**：`src/commands/**`、`src/utils/**`、`tests/**`
   - **APPROVE（需 mod 按鈕核准）**：infra/secrets/CI 檔、新增相依套件、含對外網路或讀取密鑰的程式碼
   - **HARD-DENY（絕不允許）**：靠物理隔離（repo B 碰不到），agent 根本做不到
5. push branch → CI 跑 harness。失敗 → agent 修 → 重跑（有上限）。通過 → 開 PR。
6. bot 在頻道貼 PR 連結 + diff 摘要 + `[Merge] / [Reject]`（限 ManageGuild 或 `@bot-mod`）。
7. Merge → CI build image → watchtower 部署。bot 透過 container 重建自我更新。
8. 管理員可用 `/agent-stop task-id:<id>` 停止進行中或等待確認/審批的 task。

---

## 3. 審批與懲罰

- **可審批者**：擁有 ManageGuild 權限 或 設定的 `@bot-mod` 身分組。
- **按鈕**：所有 Approve/Deny/Merge/Reject 點擊都做權限檢查，非授權點擊無效。
- **30h lockout**：mod 點 Deny，或命中明顯危險（hard-deny）→ 鎖**發話者** 30 小時。
  鎖定狀態存 DB（userId + guildId + expiry），每則進來的訊息先查。
- **timeout**（無人點按）→ 自動 Deny，**不**鎖人。

---

## 4. 安全模型

| 風險 | 對策 |
|---|---|
| agent 改自己的 guardrails | **物理隔離**：guardrails 在 repo B，token 構造上無法觸及 |
| 任意程式碼執行 | 無 bash；所有執行在 CI（無正式環境密鑰）；agent host 不跑任何不可信程式碼 |
| PR 中藏惡意碼 | diff/path 掃描 + 相依套件與網路偵測 → mod 核准；smoke-boot + CI 把關 |
| 密鑰外洩 | Discord token 只在 bot；GitHub+DeepSeek API key 只在 agent；CI 無正式密鑰 |
| 失控 / 燒錢 | 修復迭代上限 + 每 task token/時間預算 + `/agent-stop` + 每 guild 每日上限 |
| 惡意使用者 | Deny/危險 → 發話者 30h lockout |
| 部署炸機 | CI smoke-boot job + image tag rollback |

### 成本護欄（全採用）
- 每 task 修復迭代上限（如 5 次 push→CI→fix 循環）
- 每 task token + wallclock 預算（預設 60k tokens / 30 分鐘）
- kill switch：`/agent-stop task-id:<id>`，立即中止 + 清 worktree；bot 側要求 ManageGuild
- 每 guild 每日修改任務上限（預設 5 件 rolling 24h）；達標後拒新功能工作（閒聊/問答仍可）

---

## 5. Harness（GitHub Actions on Repo A）

對應流程圖的 Quality / Build / Runtime / etc 方塊，全在 CI：
- **Quality**：lint pass、test pass、format
- **Build**：typecheck + build
- **Runtime**：smoke-boot —— 以假 token / dry mode 啟動 bot，確認不 crash（擋「開機即炸」）
- **Security**：diff 掃描（新相依、對外網路、讀取 `*SECRET/TOKEN`）
- **Protected-path 複查**：縱深防禦，PR 若動到保護路徑直接 fail（即使雙 repo 已隔離）

agent loop 是 push 驅動、CI 節奏：write → push → 等 CI → 讀狀態 → 迭代。
即流程圖的「N, work and test」「N, fix」回圈。

---

## 6. 小項（已定案）

1. **內部 API 驗證** bot↔agent：共享密鑰 header（`X-Internal-Secret`，env），僅 docker
   network 內互通，不對外開埠。
2. **Agent 記憶**：每 task 獨立 context；慣例來源 = repo 的 `AGENTS.md`
   （即流程圖的「CUSTOMIZED skill」）。task 結束即清。
3. **CI / 部署 rollback**：container 加 healthcheck；watchtower 偵測 crash-loop →
   自動 redeploy 前一 image tag（多一層監控腳本）。CI 仍以 smoke-boot 為部署前閘門。
4. **誰按 Start**：發話者確認自己的計畫；危險操作後面仍要 mod 核准。

---

## 7. 與現有程式的關係

- 既有 Gemini 閒聊（`messageCreate.ts` + `ai_channel_id`）**完全不動**。
- 新增 `agent_channel_id` 設定 + `/set-agent-channel` 指令，獨立 handler。
- repo A（本 repo `discord-bot`）= 機器人功能；agent 推 branch + 開 PR 於此。
- repo B（新建）= agent service + 全部 guardrails；agent 無權限。
- agent service 使用 DeepSeek 官方 API：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL=deepseek-v4-flash`，呼叫 `https://api.deepseek.com/chat/completions`。

---

## 8. Build order（里程碑）

由易到難、每個里程碑都能獨立驗證。前期先把「不可信程式碼絕不在本機跑」與
「物理隔離」立起來，再疊功能。

### M0 — 地基與隔離（無 AI）
- 建 **repo B**（agent-service），repo A 維持現狀。
- 簽發 GitHub App / fine-grained PAT：權限只給 repo A 的 `contents:write` + `pull_requests:write`。
- repo A 加 `Dockerfile`（slim runtime）+ CI build/push image:sha。
- 上 watchtower + container healthcheck + crash-loop 自動回退腳本。
- **驗證**：手動推一個 PR → 合併 → CI build → watchtower 自動部署；故意推一個開機即 crash 的 commit → 確認自動回退前一 tag。

### M1 — Harness（CI，無 AI）
- repo A 加 GitHub Actions：lint、typecheck、test、build、smoke-boot（假 token/dry mode）。
- 加 security scan（diff：新相依、對外網路、讀取 `*SECRET/TOKEN`）。
- 加 protected-path 複查 job（縱深防禦）。
- **驗證**：開幾個 PR，分別觸發各 job pass/fail。

### M2 — Bot↔Agent 骨架（無動工能力）
- agent-service：HTTP server + 共享密鑰驗證 + 每 guild FIFO queue + DB 狀態表。
- bot：`/set-agent-channel`、`agent_channel_id` 設定、`messageCreate` 在該頻道把訊息轉給 agent；agent 回貼訊息/按鈕的內部 API。
- agent 先只做：分類意圖 + 唯讀回覆（DeepSeek 官方 API 單模型，可讀 repo，不寫不推）。
- **驗證**：頻道閒聊/問問題能正確唯讀回覆；既有 Gemini 頻道不受影響。

### M3 — 動工 loop（worktree + write/git，仍 push 才執行）
- typed 工具：`read_file` / `write_file`（路徑分級 AUTO/APPROVE）/ `git`（branch/commit/push/PR）。
- 計畫 + `[Start]/[Cancel]`（發話者確認）→ worktree + branch → loop。
- push → 讀 CI 狀態 → 失敗則修（迭代上限）→ 通過開 PR。
- 串流「Cur. working」進度到頻道。
- **驗證**：丟一個簡單功能需求（例如新 `/ping` 指令），agent 開 PR 且 CI 全綠。

### M4 — 審批與懲罰
- APPROVE 級路徑命中 → mod `[Approve]/[Deny]` 按鈕（權限檢查）。
- PR 通過 → `[Merge]/[Reject]`（mod-only）→ GitHub merge API → 觸發部署。
- 30h lockout（Deny/危險命中鎖發話者，存 DB，進站先查）；timeout 自動 Deny 不鎖。
- **驗證**：故意改 `package.json` 相依 → 觸發審批；mod Deny → 發話者被鎖 30h。

### M5 — 成本護欄與營運
- 每 task：修復迭代上限、token + wallclock 預算。
- `/agent-stop task-id:<id>` kill switch + 清 worktree。
- 每 guild 每日 task 數上限；花費以 per-task token budget 間接控制。
- 重啟 resume / 乾淨失敗通知。
- **驗證**：模擬 CI 連續失敗 → 達上限自動收手交人；`/agent-stop` 立即中止。

**實作狀態（2026-06-05）**：M5 後端護欄已 merge/deploy。repo B #6 加 `/stop`、stop/cancel registry、per-guild rolling 24h modify limit、wallclock budget、restart interrupted-task cleanup；repo B #7 加 DeepSeek token usage 記錄與 `MAX_TASK_TOKENS` enforcement；repo A #28 加 ManageGuild-only `/agent-stop`。目前 restart 採乾淨失敗，不自動 resume。live ops validation 尚待用真 Discord UI 補做。

### 風險最高、優先做對
- **M0 雙 repo + token 權限範圍**（自我保護的根基）。
- **M1 smoke-boot + M3「只有 CI 執行」**（杜絕本機 RCE）。
這兩件若沒先立穩，後面全部不安全。
