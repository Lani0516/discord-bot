import { SlashCommandBuilder } from 'discord.js';
import { getMcServer } from '../../database.js';
import { queryServer, buildStatusEmbed } from '../../utils/minecraft.js';

export const data = new SlashCommandBuilder()
  .setName('mc-status')
  .setDescription('查詢 Minecraft 伺服器狀態')
  .addStringOption(opt => opt.setName('host').setDescription('伺服器地址（不填則使用已設定的）'));

export async function execute(interaction) {
  let host, port;

  const inputHost = interaction.options.getString('host');
  if (inputHost) {
    const parts = inputHost.split(':');
    host = parts[0];
    port = parts[1] ? parseInt(parts[1]) : 25565;
  } else {
    const config = getMcServer(interaction.guild.id);
    if (!config) {
      return interaction.reply({ content: '❌ 請提供伺服器地址或先使用 /mc-setup 設定。', ephemeral: true });
    }
    host = config.host;
    port = config.port;
  }

  await interaction.deferReply();
  const data = await queryServer(host, port);
  const embedData = buildStatusEmbed(data);
  await interaction.editReply(embedData);
}
