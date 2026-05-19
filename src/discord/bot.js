// src/discord/bot.js
// Discord client wrapper: login, slash command routing, channel posting.

const { Client, GatewayIntentBits, Events, MessageFlags, REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { definitions, makeHandlers } = require('./commands');

class DiscordBot {
  constructor({ getState }) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.handlers = makeHandlers({ getState });
    this._setupEvents();
  }

  _setupEvents() {
    this.client.once(Events.ClientReady, (c) => {
      logger.bot(`Logged into Discord as ${c.user.tag}`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      const handler = this.handlers[interaction.commandName];
      if (!handler) return;
      try {
        await handler(interaction);
      } catch (err) {
        logger.error(`Slash command "${interaction.commandName}" failed:`, err);
        const reply = `Something went wrong: \`${err.message}\``;
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply).catch(() => {});
        } else {
          await interaction.reply({ content: reply, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    });
  }

  async login() {
    await this.client.login(config.discordToken);
  }

  async registerSlashCommands() {
    if (!config.discordClientId) {
      logger.warn('DISCORD_CLIENT_ID not set — skipping slash command registration. (Bot will still post sales.)');
      return;
    }
    const rest = new REST({ version: '10' }).setToken(config.discordToken);
    try {
      if (config.discordGuildId) {
        await rest.put(
          Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
          { body: definitions },
        );
        logger.ok(`Registered ${definitions.length} guild slash commands.`);
      } else {
        await rest.put(Routes.applicationCommands(config.discordClientId), { body: definitions });
        logger.ok(`Registered ${definitions.length} global slash commands (may take ~1h to propagate).`);
      }
    } catch (err) {
      logger.warn('Could not register slash commands:', err.message);
    }
  }

  async sendToChannel(payload) {
    const channel = await this.client.channels.fetch(config.channelId).catch(() => null);
    if (!channel) {
      logger.error(`Could not fetch channel ${config.channelId}. Check CHANNEL_ID and bot permissions.`);
      return;
    }
    if (!channel.isTextBased()) {
      logger.error(`Channel ${config.channelId} is not a text channel.`);
      return;
    }
    return channel.send(payload);
  }
}

module.exports = { DiscordBot };
