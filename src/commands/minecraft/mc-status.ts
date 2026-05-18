import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getMcServer } from '../../database.ts';
import { queryServer, buildStatusEmbed } from '../../utils/minecraft.ts';

export const data = new SlashCommandBuilder()
  .setName('mc-status')
  .setDescription('查詢 Minecraft 伺服器狀態')
  .addStringOption(opt => opt.setName('host').setDescription('伺服器地址（不填則使用已設定的）'));

export async function execute(interaction: ChatInputCommandInteraction) {
  let host: string;
  let port: number;

  const inputHost = interaction.options.getString('host');
  if (inputHost) {
    const parts = inputHost.split(':');
    host = parts[0];
    port = parts[1] ? parseInt(parts[1]) : 25565;
  } else {
    const config = getMcServer(interaction.guild!.id);
    if (!config) {
      return interaction.reply({ content: '尚未設定伺服器資訊，請提供伺服器地址，或先使用 /mc-setup 進行設定。', ephemeral: true });
    }
    host = config.host;
    port = config.port;
  }

  await interaction.deferReply();
  const serverData = await queryServer(host, port);
  const embedData = buildStatusEmbed(serverData);
  await interaction.editReply(embedData);
}
