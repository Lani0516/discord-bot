import { GoogleGenerativeAI } from '@google/generative-ai';
import { getChatHistory, addChatMessage, clearChatHistory, getServerConfig } from '../database.ts';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
}

export async function getAiResponse(userId: string, guildId: string, userMessage: string, userContext: AiUserContext): Promise<string> {
  try {
    const systemPrompt = getServerConfig(guildId, 'system_prompt') || DEFAULT_SYSTEM_PROMPT;

    const contextString = [
      `[使用者資訊]`,
      `名稱: ${userContext.displayName}`,
      `身分組: ${userContext.roles}`,
      `文字頻道: ${userContext.textChannel}`,
      `語音頻道: ${userContext.voiceChannel || '無'}`,
    ].join('\n');

    const fullMessage = `${contextString}\n\n${userMessage}`;

    const history = getChatHistory(userId, guildId).map(row => ({
      role: row.role,
      parts: [{ text: row.content }],
    }));

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(fullMessage);
    const responseText = result.response.text();

    addChatMessage(userId, guildId, 'user', userMessage);
    addChatMessage(userId, guildId, 'model', responseText);

    return responseText;
  } catch (error) {
    console.error('Gemini API error:', (error as Error).message);
    return '抱歉，AI 暫時無法回應。請稍後再試。';
  }
}

export function clearHistory(userId: string, guildId: string): void {
  clearChatHistory(userId, guildId);
}
