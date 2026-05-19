// src/utils/state.js
// Lightweight JSON file persistence so we don't re-notify old sales after a restart,
// and so we can keep daily/weekly stats.

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const logger = require('./logger');

const STATE_FILE = path.join(config.dataDir, 'state.json');

const DEFAULT_STATE = {
  lastSeenTransactionId: null,
  lastSeenCreated: null,
  totals: {
    allTime: { count: 0, robux: 0 },
    daily: {},   // { 'YYYY-MM-DD': { count, robux } }
  },
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
    return { ...DEFAULT_STATE, ...parsed, totals: { ...DEFAULT_STATE.totals, ...(parsed.totals || {}) } };
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

function recordSale(state, robux) {
  const day = new Date().toISOString().slice(0, 10);
  state.totals.allTime.count += 1;
  state.totals.allTime.robux += Number(robux) || 0;
  if (!state.totals.daily[day]) state.totals.daily[day] = { count: 0, robux: 0 };
  state.totals.daily[day].count += 1;
  state.totals.daily[day].robux += Number(robux) || 0;

  // Trim daily to last 60 days to keep file small.
  const days = Object.keys(state.totals.daily).sort();
  while (days.length > 60) delete state.totals.daily[days.shift()];
}

function summary(state, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  let count = 0;
  let robux = 0;
  for (const [day, totals] of Object.entries(state.totals.daily)) {
    if (day >= cutoffKey) {
      count += totals.count;
      robux += totals.robux;
    }
  }
  return { count, robux };
}

module.exports = { load, save, recordSale, summary };
