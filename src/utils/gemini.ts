import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getChatHistory,
  addChatMessage,
  clearChatHistory,
  getServerConfig,
  recordAiUsage,
} from '../database.ts';

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

const DEFAULT_SYSTEM_PROMPT = '你是一個友善的 Discord 機器人助手。請用繁體中文回覆。根據使用者的語言自動切換回覆語言。';

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 3000;

export function isOnCooldown(userId: string): boolean {
  const last = cooldowns.get(userId);
  return !!last && Date.now() - last < COOLDOWN_MS;
}

export function setCooldown(userId: string): void {
  cooldowns.set(userId, Date.now());
}

interface AiUserContext {
  displayName: string;
  roles: string;
  textChannel: string;
  voiceChannel: string | null;
  guildEmojis: string;
}

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const normalizedModel = model.toLowerCase();
  const rates = normalizedModel.includes('2.5-pro')
    ? { input: 1.25, output: 10 }
    : normalizedModel.includes('2.5-flash-lite')
      ? { input: 0.10, output: 0.40 }
      : normalizedModel.includes('2.0-flash')
        ? { input: 0.10, output: 0.40 }
        : { input: 0.30, output: 2.50 };

  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}

export async function getAiResponse(userId: string, guildId: string, userMessage: string, userContext: AiUserContext): Promise<string> {
  try {
    if (!genAI) {
      throw new Error('Missing required environment variable: GEMINI_API_KEY');
    }

    const systemPrompt = getServerConfig(guildId, 'system_prompt') || DEFAULT_SYSTEM_PROMPT;

    const contextString = [
      `[使用者資訊]`,
      `名稱: ${userContext.displayName}`,
      `身分組: ${userContext.roles}`,
      `文字頻道: ${userContext.textChannel}`,
      `語音頻道: ${userContext.voiceChannel || '無'}`,
      `可用伺服器表情: ${userContext.guildEmojis}`,
    ].join('\n');

    const fullMessage = `${contextString}\n\n${userMessage}`;

    const history = getChatHistory(userId, guildId).map(row => ({
      role: row.role,
      parts: [{ text: row.content }],
    }));

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(fullMessage);
    const responseText = result.response.text();
    const usage = result.response.usageMetadata;

    addChatMessage(userId, guildId, 'user', userMessage);
    addChatMessage(userId, guildId, 'model', responseText);

    if (usage) {
      recordAiUsage({
        guildId,
        userId,
        model: GEMINI_MODEL,
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount,
        estimatedCostUsd: estimateCostUsd(GEMINI_MODEL, usage.promptTokenCount, usage.candidatesTokenCount),
      });
    }

    return responseText;
  } catch (error) {
    console.error('Gemini API error:', (error as Error).message);
    return '抱歉，AI 暫時無法回應。請稍後再試。';
  }
}

export function clearHistory(userId: string, guildId: string): void {
  clearChatHistory(userId, guildId);
}
