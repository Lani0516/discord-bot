import { Events, Interaction, TextChannel } from 'discord.js';
import { getMcServer } from '../database.ts';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: '無法辨識此指令，該指令可能已被移除或更新。', ephemeral: true });
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const reply = { content: '執行指令時發生了意外錯誤，請稍後重新嘗試。', ephemeral: true };
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
        const config = getMcServer(interaction.guild!.id);
        if (!config) return;
        const { queryServer, buildStatusEmbed } = await import('../utils/minecraft.ts');
        const serverData = await queryServer(config.host, config.port);
        const embedData = buildStatusEmbed(serverData);
        await interaction.message.edit(embedData);
      } catch (error) {
        console.error('MC refresh button error:', error);
      }
    }
  }
}
