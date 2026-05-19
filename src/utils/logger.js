// src/utils/logger.js
// Tiny timestamped logger with emoji-tagged levels.

function ts() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function log(level, emoji, ...args) {
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  stream(`[${ts()}] ${emoji} ${level.toUpperCase().padEnd(5)} |`, ...args);
}

module.exports = {
  info: (...a) => log('info', 'ℹ️ ', ...a),
  ok: (...a) => log('info', '✅', ...a),
  warn: (...a) => log('warn', '⚠️ ', ...a),
  error: (...a) => log('error', '❌', ...a),
  sale: (...a) => log('info', '💸', ...a),
  bot: (...a) => log('info', '🤖', ...a),
  roblox: (...a) => log('info', '🟦', ...a),
  debug: (...a) => process.env.DEBUG ? log('debug', '🔎', ...a) : undefined,
};
