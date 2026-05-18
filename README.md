# Discord Bot

多功能 Discord 機器人，支援管理、趣味小遊戲、AI 聊天及 Minecraft 伺服器狀態查詢。

## 功能

### 🔧 管理指令

| 指令 | 說明 |
|------|------|
| `/ban` | 封禁成員 |
| `/kick` | 踢出成員 |
| `/mute` | 禁言成員 |
| `/unmute` | 解除禁言 |
| `/purge` | 批量刪除訊息 |
| `/serverinfo` | 查看伺服器資訊 |
| `/userinfo` | 查看用戶資訊 |

### 🤖 AI 聊天

使用 Google Gemini 2.0 Flash 模型，支援每位用戶獨立的對話紀錄。

| 指令 | 說明 |
|------|------|
| `/set-ai-channel` | 指定 AI 聊天頻道 |
| `/set-system-prompt` | 自訂 AI 人設 |
| `/view-system-prompt` | 查看目前的 AI 人設 |
| `/clear-history` | 清除你的對話紀錄 |

設定 AI 頻道後，在該頻道發送訊息即可與 AI 對話，無需使用指令。

### 🎮 趣味指令

| 指令 | 說明 |
|------|------|
| `/8ball` | 魔法 8 號球 |
| `/coinflip` | 擲硬幣 |
| `/dice` | 擲骰子 |
| `/poll` | 建立投票 |

### ⛏️ Minecraft

| 指令 | 說明 |
|------|------|
| `/mc-setup` | 綁定 Minecraft 伺服器 |
| `/mc-status` | 查詢伺服器狀態 |
| `/mc-remove` | 移除伺服器綁定 |

## 技術架構

- **Node.js v24** — ESM 模組
- **discord.js v14** — Slash Commands
- **Google Gemini** — AI 聊天
- **better-sqlite3** — 本地資料庫
- **minecraft-server-util** — MC 伺服器查詢

## 安裝

```bash
git clone https://github.com/your-username/discord-bot.git
cd discord-bot
npm install
```

## 設定

複製 `.env.example` 為 `.env`，填入你的金鑰：

```bash
cp .env.example .env
```

```env
BOT_TOKEN=你的 Discord Bot Token
GEMINI_API_KEY=你的 Google Gemini API Key
CLIENT_ID=你的 Discord Application ID
GUILD_ID=開發用伺服器 ID
```

## 啟動

```bash
# 註冊 Slash Commands
npm run deploy

# 啟動 Bot
npm start

# 開發模式（自動重載）
npm run dev
```

## 測試

```bash
npm test
```

## 授權

MIT
