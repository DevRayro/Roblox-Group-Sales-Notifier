// src/config.js
// Loads configuration from .env first, then falls back to config.json.
// .env values always win when both are set.

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');

let fileConfig = {};
if (fs.existsSync(CONFIG_PATH)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    console.warn('[config] Could not parse config.json:', err.message);
  }
}

function pick(envKey, fileKey = envKey, fallback = undefined) {
  const fromEnv = process.env[envKey];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  if (fileConfig[fileKey] !== undefined && fileConfig[fileKey] !== '') return fileConfig[fileKey];
  return fallback;
}

const config = {
  robloxCookie: pick('ROBLOX_COOKIE', 'ROBLOX_COOKIE') ?? pick('ROBLOX_TOKEN', 'ROBLOX_TOKEN'),
  discordToken: pick('DISCORD_TOKEN', 'DISCORD_TOKEN') ?? pick('BOT_TOKEN', 'BOT_TOKEN'),
  discordClientId: pick('DISCORD_CLIENT_ID', 'DISCORD_CLIENT_ID'),
  discordGuildId: pick('DISCORD_GUILD_ID', 'DISCORD_GUILD_ID', ''),
  groupId: Number(pick('GROUP_ID', 'GROUP_ID', 0)),
  channelId: String(pick('CHANNEL_ID', 'CHANNEL_ID', '')),
  pollIntervalSeconds: Number(pick('POLL_INTERVAL_SECONDS', 'POLL_INTERVAL_SECONDS', 60)),
  embedColor: String(pick('EMBED_COLOR', 'EMBED_COLOR', '00B0F4')).replace(/^#/, ''),
  sendStartupRecap: String(pick('SEND_STARTUP_RECAP', 'SEND_STARTUP_RECAP', 'false')).toLowerCase() === 'true',
  rootDir: ROOT,
  dataDir: path.join(ROOT, 'data'),
};

function validate() {
  const errors = [];
  const placeholders = [
    'YOUR_ROBLOSECURITY_COOKIE_HERE',
    'YOUR_ROBLOX_TOKEN',
    'YOUR_DISCORD_BOT_TOKEN_HERE',
    'YOUR_DISCORD_BOT_TOKEN',
    'YOUR_DISCORD_APPLICATION_ID_HERE',
    'YOUR_DISCORD_CHANNEL_ID_HERE',
    'YOUR_DISCORD_CHANNEL_ID',
    'YOUR_GROUP_ID',
  ];
  const isPlaceholder = (v) => v === undefined || v === null || placeholders.includes(String(v));

  if (isPlaceholder(config.robloxCookie)) errors.push('ROBLOX_COOKIE is missing or still set to a placeholder.');
  if (isPlaceholder(config.discordToken)) errors.push('DISCORD_TOKEN is missing or still set to a placeholder.');
  if (!config.groupId || Number.isNaN(config.groupId)) errors.push('GROUP_ID must be a non-zero number.');
  if (isPlaceholder(config.channelId) || !config.channelId) errors.push('CHANNEL_ID is missing or still set to a placeholder.');
  if (config.pollIntervalSeconds < 15) errors.push('POLL_INTERVAL_SECONDS must be at least 15 to avoid rate limits.');

  return errors;
}

config.validate = validate;

module.exports = config;
