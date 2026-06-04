# M0 — 地基與隔離（runbook）

對應 `docs/ai-agent-design.md` §8 的 M0。本里程碑無 AI，只立「物理隔離 +
不可信碼絕不在本機跑 + 自動部署/回退」的地基。

## 本里程碑產物（已落地）
| 檔案 | 作用 |
|---|---|
| `Dockerfile` | slim Bun runtime，非 root，內建 healthcheck（curl `/` health 埠） |
| `.dockerignore` | 排除密鑰/資料/測試，縮小 image |
| `src/index.ts`（改） | 加 `SMOKE_TEST=1` dry-boot（不登入 Discord）＋ `Bun.serve` health 埠 |
| `.github/workflows/build-image.yml` | push main → build → smoke-boot → push GHCR（tag `sha` + `latest`） |
| `docker-compose.yml` | bot + watchtower（自動更新）+ crash-monitor（crash-loop 回退） |
| `scripts/crash-monitor.sh` | 偵測 crash-loop / 持續 unhealthy → 用最後健康 image digest 重建容器 |
| repo B `../discord-agent-service` | agent-service 空殼（物理隔離；agent 零權限） |

## 需人工完成（一次性）

### 1. GitHub fine-grained PAT（給 agent，M2 才用，但現在簽好）
- Settings → Developer settings → Fine-grained tokens。
- **Resource owner**：Lani0516。**Repository access**：只勾 `discord-bot`（repo A）。
- **Permissions**：`Contents: Read and write`、`Pull requests: Read and write`。其餘 None。
- **絕不**授予 `discord-agent-service`（repo B）任何權限 → 物理隔離。
- token 只進 agent-service 的 env，不寫進任何 repo。

### 2. GHCR（image registry）
- CI 用內建 `GITHUB_TOKEN` 推 `ghcr.io/lani0516/discord-bot`，無需額外密鑰。
- 首次 push 後到 package 設定把 visibility / 連結 repo 設好（建議 private）。
- 部署主機 pull：`echo <PAT_with_read:packages> | docker login ghcr.io -u lani0516 --password-stdin`。
  watchtower 透過掛載的 `~/.docker/config.json` 用同一份認證。

### 3. 部署主機 `.env`
- 複製 `.env.example` 填 `BOT_TOKEN`。`docker-compose.yml` 用 `env_file: .env`。

## 驗證清單

**A. image 會開機（本機，已通過）**
```sh
bun run typecheck
SMOKE_TEST=1 bun src/index.ts          # 印 "[smoke] boot ok" 且 exit 0
docker build -t discord-bot:test .
docker run --rm -e SMOKE_TEST=1 discord-bot:test
```

**B. 推 PR → 合併 → CI build → 自動部署**
1. 開 PR 改個無害檔，合併進 main。
2. `build-image` workflow 綠 → GHCR 出現 `:latest` + `:sha`。
3. 部署主機 `docker compose up -d`；watchtower 60s 內偵測新 `:latest` → 重建 bot。
4. `docker ps` 看 bot `healthy`。

**C. crash-loop 自動回退（核心驗證）**
1. 確認 bot 跑健康一陣子（crash-monitor 記下 last-good digest：`docker logs crash-monitor`）。
2. 故意推一個「開機即 crash」的 commit（例如在 `index.ts` 頂端 `throw new Error('boom')`）。
   - 注意：CI 的 smoke-boot job 應先擋下此類 commit（M1 強化）；此處為手動模擬部署後炸機。
3. watchtower 部署壞 image → bot 反覆重啟。
4. crash-monitor 在 `WINDOW_SECONDS` 內偵測 restart 超過 `MAX_RESTARTS` → 用 last-good digest 重建。
5. `docker inspect discord-bot --format '{{.Image}}'` == last-good，bot 回 `healthy`。

## 注意
- crash-monitor 與 watchtower 會搶：壞 `:latest` 仍在 registry，watchtower 可能再拉一次。
  M0 先確保「能自動回到 last-good」；持久 pin（rollback 後鎖 tag / 標記 bad digest）留待營運強化。
- bot 目前無對外 HTTP 服務，health 埠（預設 8080）只供容器內 healthcheck，不需對外開。
