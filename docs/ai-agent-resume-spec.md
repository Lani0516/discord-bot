# Resume 決策 — interrupted agent task 是否續跑

## 目前行為（基準）
Agent service 重啟時，把 `queued`/`running`/`awaiting_confirm`/`awaiting_approval`/`awaiting_merge`/`working` 的 task 全標成 `error`，reason = `agent service restarted before task completed`。**乾淨失敗，不 resume。** 使用者需重發需求。

## 決策結論
**維持乾淨失敗，暫不實作 true resume。** 下列分析說明 resume 的成本與每個 lifecycle state 的續跑語意；若未來要做，照本 spec 逐 state 處理。

### 為何暫不做
- 重啟非常態事件（部署/crash）。乾淨失敗 + 重發成本低、語意清楚、無隱性狀態漂移。
- True resume 須跨重啟還原 worktree、branch、PR、in-memory confirm/gate registry、timeout timer，複雜度高、易出錯。
- 風險：half-applied 變更、孤兒 worktree/branch、重複 PR、過期 confirm 被誤當有效。

## 若要做 true resume：逐 state 語意

| state | in-memory 依賴 | 重啟後可否安全續跑 | 處理建議 |
| --- | --- | --- | --- |
| `queued` | 無（僅 DB） | 可 | 直接重新入列即可，最低風險，**第一階段只做這個**。 |
| `running` | classify 進行中 | 否 | classify 無副作用（未建 worktree）→ 視同 `queued` 重跑。 |
| `working` | tool loop + worktree + 已 push branch | 困難 | 須還原 worktree 路徑或重 clone、決定接續 step 或從頭。建議標 error，附 branch 名供人工接手。 |
| `awaiting_confirm` | confirm registry（發話者待點按鈕） | 否 | 按鈕 interaction token 已失效 → 須重貼計畫 + 新按鈕。 |
| `awaiting_approval` | gate registry（mod 待核准 write_file） | 否 | 同上，須重貼 mod-gate。worktree 半成品須先決定保留或丟。 |
| `awaiting_merge` | merge gate（CI 已綠、待 mod merge） | 部分可 | PR 仍在、CI 結果仍在 → 可重貼 merge 按鈕，不必重跑 loop。**第二便宜的 resume**。 |

## 建議實作順序（若啟動）
1. **先寫 migration-safe 持久化**：把 confirm/gate/merge registry 從純 in-memory 落 DB（含 requester id、PR number、branch、worktree path、expiry）。
2. **Phase 1**：`queued`/`running` → 重啟自動重入列（無副作用，最安全）。
3. **Phase 2**：`awaiting_merge` → 重啟後對 PR 重新 poll CI + 重貼 merge 按鈕。
4. **Phase 3（高風險，最後）**：`working`/`awaiting_confirm`/`awaiting_approval` → 需 worktree 還原策略 + 重貼按鈕；先決定「丟棄半成品重跑」vs「續接」。預設建議丟棄重跑（語意簡單）。

## 前置條件
- Discord button interaction token 約 15 分鐘失效 → 任何 await 狀態 resume 都不能重用舊 token，一律重貼新訊息/按鈕。
- worktree 與 branch 須在重啟前確認未被 GC；resume 前先驗證路徑存在，否則退回重 clone 或標 error。
