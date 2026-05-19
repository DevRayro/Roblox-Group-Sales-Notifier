// src/scripts/registerCommands.js
// Standalone helper: register slash commands without starting the full bot.
// Usage:  npm run register

const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { definitions } = require('../discord/commands');

async function main() {
  if (!config.discordToken) {
    logger.error('DISCORD_TOKEN is missing.');
    process.exit(1);
  }
  if (!config.discordClientId) {
    logger.error('DISCORD_CLIENT_ID is missing — required to register commands.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  if (config.discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
      { body: definitions },
    );
    logger.ok(`Registered ${definitions.length} guild commands (instant) for guild ${config.discordGuildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(config.discordClientId), { body: definitions });
    logger.ok(`Registered ${definitions.length} global commands. Allow up to ~1 hour for them to appear in clients.`);
  }
}

main().catch((err) => {
  logger.error('Failed to register commands:', err.response?.data || err);
  process.exit(1);
});
