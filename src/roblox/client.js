// src/roblox/client.js
// Direct Roblox API client (replaces the deprecated noblox.js).
// Handles cookie auth, X-CSRF-TOKEN refresh, and the few endpoints we need.

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const USER_AGENT = 'Roblox-Group-Sales-Notifier/2.0 (+https://github.com/DevRayro/Roblox-Group-Sales-Notifier)';

class RobloxClient {
  constructor(cookie) {
    this.cookie = cookie;
    this.csrfToken = null;
    this.http = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
  }

  authHeaders(extra = {}) {
    const headers = {
      Cookie: `.ROBLOSECURITY=${this.cookie}`,
      ...extra,
    };
    if (this.csrfToken) headers['X-CSRF-TOKEN'] = this.csrfToken;
    return headers;
  }

  async request(method, url, opts = {}) {
    const doRequest = () => this.http.request({
      method,
      url,
      headers: this.authHeaders(opts.headers || {}),
      params: opts.params,
      data: opts.data,
    });

    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const res = await doRequest();
        return res.data;
      } catch (err) {
        const status = err.response?.status;
        const headers = err.response?.headers || {};

        // CSRF token refresh: Roblox returns the new token on 403 with the header.
        if (status === 403 && headers['x-csrf-token'] && attempt === 1) {
          this.csrfToken = headers['x-csrf-token'];
          continue;
        }

        // Rate-limit retry, honoring Retry-After (capped to keep startup snappy).
        if (status === 429 && attempt <= 3) {
          const retryAfter = Number(headers['retry-after']) || 5;
          const waitMs = Math.min(retryAfter, 8) * 1000;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // Throw a sanitized error so the cookie never lands in logs.
        const safe = new Error(`Roblox API ${method} ${this._safeUrl(url)} failed: ${status || err.code || 'network error'}`);
        safe.status = status;
        safe.code = err.code;
        safe.responseBody = err.response?.data;
        throw safe;
      }
    }
  }

  _safeUrl(url) {
    try { return new URL(url).pathname; } catch { return url; }
  }

  async whoAmI() {
    // https://users.roblox.com/v1/users/authenticated
    return this.request('GET', 'https://users.roblox.com/v1/users/authenticated');
  }

  async getGroupTransactions(groupId, { transactionType = 'Sale', limit = 25, cursor = '', sortOrder = 'Desc' } = {}) {
    // https://economy.roblox.com/v2/groups/{groupId}/transactions
    return this.request('GET', `https://economy.roblox.com/v2/groups/${groupId}/transactions`, {
      params: { transactionType, limit, cursor, sortOrder },
    });
  }

  // Walks the paginated transactions endpoint backwards in time until the cutoff.
  // Returns { count, robux, transactions } for sales newer than `since`.
  async aggregateSalesSince(groupId, since, { hardCap = 1000, maxPages = 10, pageDelayMs = 350 } = {}) {
    const cutoff = since instanceof Date ? since.getTime() : new Date(since).getTime();
    let cursor = '';
    let count = 0;
    let robux = 0;
    const transactions = [];
    let pages = 0;
    while (pages < maxPages) {
      if (pages > 0 && pageDelayMs > 0) {
        await new Promise((r) => setTimeout(r, pageDelayMs));
      }
      const res = await this.getGroupTransactions(groupId, {
        transactionType: 'Sale', limit: 100, sortOrder: 'Desc', cursor,
      });
      const data = (res && res.data) || [];
      if (!data.length) break;

      let reachedCutoff = false;
      for (const tx of data) {
        const ts = tx.created ? new Date(tx.created).getTime() : 0;
        if (ts < cutoff) { reachedCutoff = true; break; }
        count += 1;
        robux += Number(tx.currency?.amount) || 0;
        if (transactions.length < hardCap) transactions.push(tx);
      }
      if (reachedCutoff) break;
      if (!res.nextPageCursor) break;
      cursor = res.nextPageCursor;
      pages += 1;
    }
    return { count, robux, transactions };
  }

  async getGroupInfo(groupId) {
    return this.request('GET', `https://groups.roblox.com/v1/groups/${groupId}`);
  }

  async getGroupCurrency(groupId) {
    // Pending + available robux for the group.
    return this.request('GET', `https://economy.roblox.com/v1/groups/${groupId}/currency`);
  }

  async getUserInfo(userId) {
    return this.request('GET', `https://users.roblox.com/v1/users/${userId}`);
  }

  async getUserHeadshot(userId, size = '420x420') {
    // https://thumbnails.roblox.com/v1/users/avatar-headshot
    const data = await this.request('GET', 'https://thumbnails.roblox.com/v1/users/avatar-headshot', {
      params: { userIds: userId, size, format: 'Png', isCircular: false },
    });
    if (data && data.data && data.data[0]) return data.data[0].imageUrl;
    return null;
  }

  async getUserAvatar(userId, size = '420x420') {
    // Full-body avatar — the user's "skin".
    const data = await this.request('GET', 'https://thumbnails.roblox.com/v1/users/avatar', {
      params: { userIds: userId, size, format: 'Png', isCircular: false },
    });
    if (data && data.data && data.data[0]) return data.data[0].imageUrl;
    return null;
  }

  async getAssetThumbnail(assetId, size = '420x420') {
    if (!assetId) return null;
    const data = await this.request('GET', 'https://thumbnails.roblox.com/v1/assets', {
      params: { assetIds: assetId, size, format: 'Png', isCircular: false },
    });
    if (data && data.data && data.data[0]) return data.data[0].imageUrl;
    return null;
  }

  async getGroupIcon(groupId, size = '420x420') {
    if (!groupId) return null;
    const data = await this.request('GET', 'https://thumbnails.roblox.com/v1/groups/icons', {
      params: { groupIds: groupId, size, format: 'Png', isCircular: false },
    });
    if (data && data.data && data.data[0]) return data.data[0].imageUrl;
    return null;
  }
}

let _instance = null;
function getClient() {
  if (!_instance) {
    _instance = new RobloxClient(config.robloxCookie);
  }
  return _instance;
}

module.exports = { RobloxClient, getClient };
