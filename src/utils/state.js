// src/utils/state.js
// Persists the last seen transaction so a restart does not re-post old sales.
// Real stats (today, last 7 days, etc.) are pulled live from Roblox — see
// roblox/client.js#aggregateSalesSince.

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const logger = require('./logger');

const STATE_FILE = path.join(config.dataDir, 'state.json');

const DEFAULT_STATE = {
  lastSeenTransactionId: null,
  lastSeenCreated: null,
  startedAt: new Date().toISOString(),
};

function ensureDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

function load() {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return { ...DEFAULT_STATE, ...parsed };
  } catch (err) {
    logger.warn('Could not read state file, starting fresh:', err.message);
    return { ...DEFAULT_STATE };
  }
}

function save(state) {
  ensureDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.error('Could not write state file:', err.message);
  }
}

module.exports = { load, save };
