// src/roblox/poller.js
// Polls the Roblox group transactions endpoint and emits new sales.

const EventEmitter = require('node:events');
const { getClient } = require('./client');
const logger = require('../utils/logger');

class TransactionPoller extends EventEmitter {
  constructor({ groupId, intervalSeconds = 60 }) {
    super();
    this.groupId = groupId;
    this.intervalMs = intervalSeconds * 1000;
    this._timer = null;
    this._running = false;
    this._lastSeenKey = null; // idHash or numeric id, whichever is non-empty
    this._lastSeenCreated = null;
    this._client = getClient();
  }

  primeFromState(state) {
    this._lastSeenKey = state.lastSeenTransactionId || null;
    this._lastSeenCreated = state.lastSeenCreated || null;
  }

  // Roblox sets `id: 0` for many recent transactions; the unique identifier is `idHash`.
  _txKey(tx) {
    return tx.idHash || (tx.id ? String(tx.id) : null);
  }

  start() {
    if (this._timer) return;
    logger.info(`Polling group ${this.groupId} every ${this.intervalMs / 1000}s for new sales.`);
    this._tick().catch((e) => logger.error('Initial poll failed:', e.message));
    this._timer = setInterval(() => {
      this._tick().catch((e) => logger.error('Poll failed:', e.message));
    }, this.intervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _tick() {
    if (this._running) return; // Skip overlapping ticks if a request is slow.
    this._running = true;
    try {
      const res = await this._client.getGroupTransactions(this.groupId, {
        transactionType: 'Sale',
        limit: 25,
        sortOrder: 'Desc',
      });

      const transactions = (res && res.data) || [];
      if (!transactions.length) return;

      // Filter to only those newer than the last seen one.
      const newOnes = [];
      for (const tx of transactions) {
        if (this._isNewer(tx)) newOnes.push(tx);
        else break; // Sorted Desc — stop on first old one.
      }

      // Emit oldest-first so order is natural in chat.
      for (const tx of newOnes.reverse()) {
        this.emit('sale', tx);
      }

      // Update bookmarks to the most recent transaction we saw.
      const newest = transactions[0];
      this._lastSeenKey = this._txKey(newest) || this._lastSeenKey;
      this._lastSeenCreated = newest.created || this._lastSeenCreated;
      this.emit('progress', {
        lastSeenTransactionId: this._lastSeenKey,
        lastSeenCreated: this._lastSeenCreated,
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        logger.error('Roblox returned 401 Unauthorized. Your ROBLOX_COOKIE is invalid or expired.');
      } else if (status === 403) {
        logger.error('Roblox returned 403 Forbidden. The cookie account may not have permission to view group transactions.');
      } else if (status === 429) {
        logger.warn('Rate limited by Roblox. Consider increasing POLL_INTERVAL_SECONDS.');
      } else {
        logger.error('Roblox poll error:', err.message);
      }
      this.emit('error', err);
    } finally {
      this._running = false;
    }
  }

  _isNewer(tx) {
    // First run after a fresh install: do not flood — start tracking from "now".
    if (!this._lastSeenKey && !this._lastSeenCreated) return false;
    const key = this._txKey(tx);
    if (this._lastSeenKey && key && key === this._lastSeenKey) return false;
    if (this._lastSeenCreated && tx.created) {
      return new Date(tx.created).getTime() > new Date(this._lastSeenCreated).getTime();
    }
    return true;
  }

  // Capture the most recent transaction without emitting it, so first-run does not
  // flood the channel with already-old sales.
  async primeBaseline() {
    try {
      const res = await this._client.getGroupTransactions(this.groupId, {
        transactionType: 'Sale', limit: 1, sortOrder: 'Desc',
      });
      const newest = res?.data?.[0];
      if (newest) {
        this._lastSeenKey = this._txKey(newest);
        this._lastSeenCreated = newest.created;
        this.emit('progress', {
          lastSeenTransactionId: this._lastSeenKey,
          lastSeenCreated: this._lastSeenCreated,
        });
      }
    } catch (err) {
      // Non-fatal — first poll will still work.
    }
  }
}

module.exports = { TransactionPoller };
