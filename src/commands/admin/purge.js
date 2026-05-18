import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('批量刪除訊息')
  .addIntegerOption(opt => opt.setName('amount').setDescription('要刪除的數量').setMinValue(1).setMaxValue(100).setRequired(true))
  .addUserOption(opt => opt.setName('user').setDescription('只刪除特定成員的訊息'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount');
  const targetUser = interaction.options.getUser('user');

  await interaction.deferReply({ ephemeral: true });

  let deleted;
  if (targetUser) {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const filtered = messages
      .filter(m => m.author.id === targetUser.id)
      .first(amount);
    deleted = await interaction.channel.bulkDelete(filtered, true);
  } else {
    deleted = await interaction.channel.bulkDelete(amount, true);
  }

  const reply = await interaction.editReply(`✅ 已刪除 ${deleted.size} 則訊息。`);
  setTimeout(() => reply.delete().catch(() => {}), 5000);
}
