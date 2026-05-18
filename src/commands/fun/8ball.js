import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const responses = [
  '毫無疑問。', '當然是的。', '毋庸置疑。', '是的，絕對是。', '你可以信賴它。',
  '依我所見，是的。', '很有可能。', '前景看好。', '是的。', '跡象指向是。',
  '回覆模糊，請再試一次。', '稍後再問。', '最好現在不要告訴你。', '現在無法預測。', '先集中精神再問。',
  '別指望了。', '我的回答是不。', '我的消息來源說不。', '前景不太好。', '非常不確定。',
];

export const data = new SlashCommandBuilder()
  .setName('8ball')
  .setDescription('詢問神奇 8 號球')
  .addStringOption(opt => opt.setName('question').setDescription('你的問題').setRequired(true));

export async function execute(interaction) {
  const question = interaction.options.getString('question');
  const answer = responses[Math.floor(Math.random() * responses.length)];

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎱 神奇 8 號球')
    .addFields(
      { name: '❓ 問題', value: question },
      { name: '🔮 回答', value: answer },
    );

  await interaction.reply({ embeds: [embed] });
}
