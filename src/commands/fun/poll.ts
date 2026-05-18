import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('建立投票')
  .addStringOption(opt => opt.setName('question').setDescription('投票問題').setRequired(true))
  .addStringOption(opt => opt.setName('option1').setDescription('選項 1').setRequired(true))
  .addStringOption(opt => opt.setName('option2').setDescription('選項 2').setRequired(true))
  .addStringOption(opt => opt.setName('option3').setDescription('選項 3'))
  .addStringOption(opt => opt.setName('option4').setDescription('選項 4'))
  .addStringOption(opt => opt.setName('option5').setDescription('選項 5'));

export async function execute(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString('question')!;
  const options: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const opt = interaction.options.getString(`option${i}`);
    if (opt) options.push(opt);
  }

  const description = options
    .map((opt, i) => `選項 ${i + 1}：${opt}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`投票：${question}`)
    .setDescription(description)
    .setFooter({ text: `由 ${interaction.user.tag} 發起` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
  const message = await interaction.fetchReply();

  for (let i = 0; i < options.length; i++) {
    await message.react(numberEmojis[i]);
  }
}
