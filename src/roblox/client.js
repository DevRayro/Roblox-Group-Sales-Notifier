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
    try {
      const res = await this.http.request({
        method,
        url,
        headers: this.authHeaders(opts.headers || {}),
        params: opts.params,
        data: opts.data,
      });
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 403 && err.response.headers['x-csrf-token']) {
        this.csrfToken = err.response.headers['x-csrf-token'];
        // Retry once with the refreshed token.
        const res = await this.http.request({
          method,
          url,
          headers: this.authHeaders(opts.headers || {}),
          params: opts.params,
          data: opts.data,
        });
        return res.data;
      }
      throw err;
    }
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

  async getAssetThumbnail(assetId, size = '420x420') {
    if (!assetId) return null;
    const data = await this.request('GET', 'https://thumbnails.roblox.com/v1/assets', {
      params: { assetIds: assetId, size, format: 'Png', isCircular: false },
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
