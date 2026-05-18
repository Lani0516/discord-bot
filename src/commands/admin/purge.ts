import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('批量刪除訊息')
  .addIntegerOption(opt => opt.setName('amount').setDescription('要刪除的數量').setMinValue(1).setMaxValue(100).setRequired(true))
  .addUserOption(opt => opt.setName('user').setDescription('只刪除特定成員的訊息'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger('amount')!;
  const targetUser = interaction.options.getUser('user');
  const channel = interaction.channel as TextChannel;

  await interaction.deferReply({ ephemeral: true });

  let deleted;
  if (targetUser) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const filtered = messages
      .filter(m => m.author.id === targetUser.id)
      .first(amount);
    deleted = await channel.bulkDelete(filtered, true);
  } else {
    deleted = await channel.bulkDelete(amount, true);
  }

  const reply = await interaction.editReply(`成功清除了 ${deleted.size} 則訊息，頻道已整理完畢。`);
  setTimeout(() => reply.delete().catch(() => {}), 5000);
}
