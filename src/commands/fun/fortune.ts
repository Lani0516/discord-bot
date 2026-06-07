import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

/**
 * おみくじ（御神籤）運勢等級，由大吉至大凶。
 *
 * 為了讓同一個使用者在同一天內拿到同一支籤，
 * 採用 user_id + 當日日期作為 seed 進行擬亂數，
 * 不需要額外寫資料庫。
 */

const FORTUNES = [
  { rank: '大吉', emoji: '🌟', description: '萬事亨通，心想事成！今日是你的幸運日。', color: 0xffd700 },
  { rank: '吉',   emoji: '✨', description: '順風順水，平穩順利的一天。',       color: 0x4caf50 },
  { rank: '中吉', emoji: '☀️', description: '整體不錯，小有收穫。',             color: 0x8bc34a },
  { rank: '小吉', emoji: '🌤️', description: '還算可以，有些小事值得期待。',     color: 0xcddc39 },
  { rank: '末吉', emoji: '🌥️', description: '差強人意，謹慎行事可保平安。',     color: 0xffc107 },
  { rank: '凶',   emoji: '🌧️', description: '運勢稍低，凡事多加小心。',         color: 0xff9800 },
  { rank: '大凶', emoji: '⛈️', description: '運勢低迷，宜靜不宜動，忍一時風平浪靜。', color: 0xf44336 },
];

/** 將字串 hash 為 [0, 1) 之間的浮點數，當作可複現的亂數用。 */
function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 轉為 32-bit int
  }
  // 取絕對值後正規化到 [0, 1)
  return Math.abs(hash) / 0x7fffffff;
}

/** 產生當日 seed：user_id + YYYY-MM-DD */
function todaySeed(userId: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${userId}|${yyyy}-${mm}-${dd}`;
}

/** 根據 seed 從陣列中選取一個元素（固定結果）。 */
function seededPick<T>(arr: readonly T[], seed: string): T {
  const idx = Math.floor(hashSeed(seed) * arr.length);
  return arr[idx];
}

export const data = new SlashCommandBuilder()
  .setName('fortune')
  .setDescription('抽一支今日運勢籤（大吉～大凶），同一天同一人結果相同。');

export async function execute(interaction: ChatInputCommandInteraction) {
  const seed = todaySeed(interaction.user.id);
  const fortune = seededPick(FORTUNES, seed);

  const embed = new EmbedBuilder()
    .setColor(fortune.color)
    .setTitle(`${fortune.emoji} 今日運勢 — ${fortune.rank}`)
    .setDescription(fortune.description)
    .setFooter({ text: `${interaction.user.displayName} 的籤 · 今日有效` });

  await interaction.reply({ embeds: [embed] });
}
