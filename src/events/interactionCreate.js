import { Events } from 'discord.js';
import { getMcServer } from '../database.js';

export const name = Events.InteractionCreate;

export async function execute(interaction) {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: '❌ 找不到此指令。', ephemeral: true });
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const reply = { content: '❌ 執行指令時發生錯誤。', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'mc_refresh') {
      await interaction.deferUpdate();
      try {
        const config = getMcServer(interaction.guild.id);
        if (!config) return;
        const { queryServer, buildStatusEmbed } = await import('../utils/minecraft.js');
        const data = await queryServer(config.host, config.port);
        const embedData = buildStatusEmbed(data);
        await interaction.message.edit(embedData);
      } catch (error) {
        console.error('MC refresh button error:', error);
      }
    }
  }
}
