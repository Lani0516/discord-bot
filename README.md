# Discord Bot

多功能 Discord 機器人，提供伺服器管理、趣味互動、Google Gemini AI 聊天，以及 Minecraft Java 伺服器狀態監控。專案使用 Bun 與 TypeScript 開發，指令以 Discord Slash Commands 為主。

## 功能總覽

### 伺服器管理

管理指令提供常見的伺服器維護操作，並使用 Discord 權限控管可執行的成員。

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/ban` | 封鎖指定成員，可選擇刪除最近 0 到 7 天的訊息並記錄原因。 | 封鎖成員 |
| `/kick` | 踢出指定成員並可填寫原因。 | 踢出成員 |
| `/mute` | 對指定成員設定逾時禁言，時間範圍為 1 到 10080 分鐘。 | 管理成員 |
| `/unmute` | 解除指定成員的禁言狀態。 | 管理成員 |
| `/purge` | 批量刪除頻道訊息，可限定只刪除特定成員的訊息。 | 管理訊息 |
| `/serverinfo` | 顯示目前 Discord 伺服器資訊。 | 無特殊權限 |
| `/userinfo` | 顯示指定使用者或自己的帳號與伺服器資訊。 | 無特殊權限 |

### AI 聊天

AI 聊天使用 Google Gemini API。伺服器管理員可以指定 AI 自動回覆頻道、調整系統提示，並查看本月 API 使用量與預估成本。

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/set-ai-channel` | 設定 AI 自動回覆頻道。不選擇頻道時會關閉自動回覆。 | 管理伺服器 |
| `/set-system-prompt` | 設定此伺服器使用的 AI 系統提示。 | 管理伺服器 |
| `/view-system-prompt` | 查看目前的 AI 系統提示。 | 無特殊權限 |
| `/clear-history` | 清除自己的 AI 對話紀錄。 | 無特殊權限 |
| `/ai-usage` | 查看本月 AI API 用量與預估成本，可指定使用者查詢。 | 管理伺服器 |

設定 AI 頻道後，使用者在該頻道發送一般訊息即可與 AI 對話，不需要額外輸入 Slash Command。系統會保存每位使用者在每個伺服器的最近對話紀錄，讓 AI 回覆能參考上下文。

### 趣味互動

| 指令 | 用途 |
| --- | --- |
| `/8ball` | 向神奇 8 號球提問並取得隨機回答。 |
| `/coinflip` | 擲硬幣，隨機產生正面或反面。 |
| `/dice` | 擲一顆或多顆骰子，可設定面數與數量。 |
| `/poll` | 建立最多五個選項的投票。 |

### Minecraft 伺服器監控

Minecraft 功能可以查詢或監控 Java 版伺服器狀態。綁定伺服器後，機器人會在指定頻道發布狀態訊息，並依照設定的間隔自動更新。

| 指令 | 用途 | 需要權限 |
| --- | --- | --- |
| `/mc-setup` | 設定要監控的 Minecraft 伺服器、顯示頻道、連接埠與更新間隔。 | 管理伺服器 |
| `/mc-status` | 查詢指定伺服器，或查詢目前伺服器已綁定的 Minecraft 狀態。 | 無特殊權限 |
| `/mc-remove` | 移除目前 Discord 伺服器的 Minecraft 監控設定。 | 管理伺服器 |

## 技術架構

- 執行環境：Bun
- 語言：TypeScript，ESM 模組
- Discord SDK：discord.js v14
- AI 服務：Google Gemini API
- 資料庫：Bun 內建 SQLite API
- Minecraft 查詢：minecraft-server-util

主要入口與模組：

```text
src/
  index.ts                  Bot 入口，載入指令、事件並登入 Discord
  deploy-commands.ts        註冊 Slash Commands
  database.ts               SQLite 資料存取與資料表初始化
  events/                   Discord 事件處理
  commands/
    admin/                  管理指令
    ai/                     AI 相關指令
    fun/                    趣味互動指令
    minecraft/              Minecraft 相關指令
  utils/
    gemini.ts               Gemini 對話、冷卻時間、用量紀錄
    minecraft.ts            Minecraft 狀態查詢與訊息格式化
```

## 資料儲存

專案會自動建立 `data/` 目錄存放本地 SQLite 資料。

| 路徑 | 說明 |
| --- | --- |
| `data/bot.db` | 儲存伺服器設定、Minecraft 監控設定與 AI 用量紀錄。 |
| `data/chat-history/<guild_id>/<user_id>.db` | 依伺服器與使用者分開儲存 AI 對話紀錄。 |

`data/` 目錄屬於執行期資料，不應提交到版本控制。

## 安裝需求

請先安裝下列項目：

- Bun
- Discord Bot Token
- Discord Application Client ID
- Discord 開發用伺服器 Guild ID
- Google Gemini API Key

## 安裝專案

```bash
git clone https://github.com/Lani0516/discord-bot.git
cd discord-bot
bun install
```

## 環境變數設定

複製範例檔案並建立本機 `.env`：

```bash
cp .env.example .env
```

在 `.env` 中填入以下設定：

```env
BOT_TOKEN=你的 Discord Bot Token
GEMINI_API_KEY=你的 Google Gemini API Key
GEMINI_MODEL=gemini-2.5-flash
CLIENT_ID=你的 Discord Application Client ID
GUILD_ID=開發用 Discord 伺服器 ID
```

環境變數說明：

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `BOT_TOKEN` | 是 | Discord Bot Token，用於登入機器人。 |
| `GEMINI_API_KEY` | 是 | Google Gemini API Key，用於 AI 聊天功能。 |
| `GEMINI_MODEL` | 否 | Gemini 模型名稱，未設定時預設使用 `gemini-2.5-flash`。 |
| `CLIENT_ID` | 是 | Discord Application Client ID，用於註冊 Slash Commands。 |
| `GUILD_ID` | 是 | 開發用 Discord 伺服器 ID，Slash Commands 會註冊到此伺服器。 |

## 註冊指令

首次啟動前，或新增、修改 Slash Commands 後，請執行：

```bash
bun run deploy
```

目前指令註冊為 guild-scoped，適合開發與單一伺服器部署。若要改成全域指令，需要調整 `src/deploy-commands.ts`。

## 啟動機器人

正式啟動：

```bash
bun start
```

開發模式啟動，檔案變更後會自動重新載入：

```bash
bun run dev
```

## 測試與型別檢查

執行測試：

```bash
bun test
```

執行 TypeScript 型別檢查：

```bash
bun run typecheck
```

## Discord 權限與 Intents

機器人目前使用以下 Gateway Intents：

- Guilds
- GuildMessages
- MessageContent
- GuildMembers
- GuildVoiceStates

若 AI 自動回覆需要讀取一般訊息內容，請在 Discord Developer Portal 啟用 Message Content Intent，並確認邀請機器人時授予必要的伺服器權限。

## 開發規範

- 指令檔案放在 `src/commands/<category>/`。
- 每個指令模組需匯出 `data` 與 `execute`。
- 事件檔案放在 `src/events/`。
- 每個事件模組需匯出 `name`、`execute`，可選擇匯出 `once`。
- 預設使用繁體中文作為 Bot 回覆語言。
- `.env` 與 `data/` 不應提交到 Git。

## 授權

MIT
