#!/usr/bin/env node
// scripts/setup.js
// Interactive cross-platform setup wizard.
//
//   - Verifies Node.js version
//   - Runs `npm install` if needed
//   - Prompts for every credential, validating each against the live API
//   - Hides input for the Roblox cookie and Discord bot token
//   - Auto-derives the Discord application ID from the bot token
//   - Writes .env (preserving any existing values the user wants to keep)
//   - Offers to register slash commands
//   - Offers to launch the bot
//
// No external deps — uses only Node's stdlib.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const readline = require('node:readline');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const PKG_PATH = path.join(ROOT, 'package.json');

// ─── Pretty output ───────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (col, s) => (supportsColor ? `${col}${s}${c.reset}` : s);
const ok = (s) => console.log(paint(c.green, '✔ ') + s);
const warn = (s) => console.log(paint(c.yellow, '! ') + s);
const fail = (s) => console.log(paint(c.red, '✘ ') + s);
const info = (s) => console.log(paint(c.cyan, '› ') + s);
const head = (s) => console.log('\n' + paint(c.bold + c.magenta, s));

function banner() {
  console.log('');
  console.log(paint(c.cyan, '  ============================================================'));
  console.log(paint(c.cyan, '    Roblox Group Sales Notifier  -  Setup Wizard'));
  console.log(paint(c.cyan, '  ============================================================'));
  console.log('');
}

// ─── Readline helpers ────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, { defaultValue = '', secret = false, validate } = {}) {
  return new Promise((resolve) => {
    const display = defaultValue
      ? `${question} ${paint(c.dim, `[${secret ? '****' : defaultValue}]`)}: `
      : `${question}: `;

    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!secret) {
      rl.question(display, async (raw) => {
        let answer = (raw || '').trim() || defaultValue;
        if (validate) {
          const v = await validate(answer);
          if (v !== true) {
            fail(v || 'Invalid value, please try again.');
            return resolve(ask(question, { defaultValue, secret, validate }));
          }
        }
        resolve(answer);
      });
      return;
    }

    // Secret input: echo asterisks instead of the actual characters.
    stdout.write(display);
    let buffer = '';
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = async (key) => {
      // Handle pasted strings (key may contain many chars at once).
      for (const ch of key) {
        if (ch === '\u0003') {
          stdout.write('\n');
          process.exit(130);
        } else if (ch === '\r' || ch === '\n') {
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) stdin.setRawMode(wasRaw || false);
          stdout.write('\n');
          let answer = buffer.trim() || defaultValue;
          if (validate) {
            const v = await validate(answer);
            if (v !== true) {
              fail(v || 'Invalid value, please try again.');
              return resolve(ask(question, { defaultValue, secret, validate }));
            }
          }
          return resolve(answer);
        } else if (ch === '\u007f' || ch === '\b') {
          if (buffer.length) {
            buffer = buffer.slice(0, -1);
            stdout.write('\b \b');
          }
        } else {
          buffer += ch;
          stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const a = (await ask(`${question} (${hint})`)).toLowerCase();
  if (!a) return defaultYes;
  return a === 'y' || a === 'yes';
}

// ─── Tiny HTTPS GET helper (no axios needed before npm install) ──────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'User-Agent': 'Roblox-Group-Sales-Notifier-Setup/1.0',
        Accept: 'application/json',
        ...headers,
      },
      timeout: 12000,
    }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch { /* not json */ }
        resolve({ status: res.statusCode, body: parsed, raw: body });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

// ─── Validators ──────────────────────────────────────────────────────────
async function validateRobloxCookie(cookie) {
  if (!cookie || cookie.length < 50) return 'That does not look like a .ROBLOSECURITY cookie. It is usually 800+ characters.';
  try {
    const r = await httpGet('https://users.roblox.com/v1/users/authenticated', {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    });
    if (r.status === 200 && r.body && r.body.id) {
      ok(`Roblox cookie OK — logged in as ${paint(c.bold, r.body.name)} (${r.body.id}).`);
      return true;
    }
    if (r.status === 401) return 'Roblox rejected the cookie (401). Make sure you copied the full value of .ROBLOSECURITY.';
    return `Unexpected response from Roblox (HTTP ${r.status}). Try again.`;
  } catch (err) {
    return `Could not reach Roblox: ${err.message}`;
  }
}

async function validateDiscordToken(token) {
  if (!token || !token.includes('.')) return 'That does not look like a Discord bot token.';
  try {
    const r = await httpGet('https://discord.com/api/v10/users/@me', {
      Authorization: `Bot ${token}`,
    });
    if (r.status === 200 && r.body && r.body.id) {
      ok(`Discord bot token OK — bot username: ${paint(c.bold, r.body.username + (r.body.discriminator && r.body.discriminator !== '0' ? '#' + r.body.discriminator : ''))}.`);
      return { applicationId: r.body.id };
    }
    if (r.status === 401) return 'Discord rejected the token (401). Reset it in the Developer Portal and try again.';
    return `Unexpected response from Discord (HTTP ${r.status}).`;
  } catch (err) {
    return `Could not reach Discord: ${err.message}`;
  }
}

async function validateGroupId(idStr, cookie) {
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return 'Group ID must be a positive number.';
  try {
    const r = await httpGet(`https://groups.roblox.com/v1/groups/${id}`, {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    });
    if (r.status === 200 && r.body && r.body.name) {
      ok(`Group OK — ${paint(c.bold, r.body.name)} (${r.body.memberCount?.toLocaleString('en-US') ?? '?'} members).`);
      return true;
    }
    if (r.status === 400 || r.status === 404) return `No group found with ID ${id}.`;
    return `Unexpected response from Roblox (HTTP ${r.status}).`;
  } catch (err) {
    return `Could not reach Roblox: ${err.message}`;
  }
}

function validateChannelId(idStr) {
  if (!/^\d{15,25}$/.test(String(idStr).trim())) {
    return 'Channel ID must be a Discord snowflake (15-25 digits). Right-click the channel in Discord and "Copy Channel ID" with Developer Mode enabled.';
  }
  return true;
}

function validateGuildId(idStr) {
  if (!idStr) return true; // optional
  if (!/^\d{15,25}$/.test(String(idStr).trim())) {
    return 'Guild ID must be a Discord snowflake, or empty for global registration.';
  }
  return true;
}

// ─── Existing .env loader ────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function writeEnv(values) {
  const lines = [
    '# Generated by `npm run setup` — feel free to edit by hand later.',
    `ROBLOX_COOKIE=${values.ROBLOX_COOKIE}`,
    `DISCORD_TOKEN=${values.DISCORD_TOKEN}`,
    `DISCORD_CLIENT_ID=${values.DISCORD_CLIENT_ID}`,
    `DISCORD_GUILD_ID=${values.DISCORD_GUILD_ID || ''}`,
    `GROUP_ID=${values.GROUP_ID}`,
    `CHANNEL_ID=${values.CHANNEL_ID}`,
    `POLL_INTERVAL_SECONDS=${values.POLL_INTERVAL_SECONDS || 60}`,
    `EMBED_COLOR=${values.EMBED_COLOR || '00B0F4'}`,
    `SEND_STARTUP_RECAP=${values.SEND_STARTUP_RECAP ?? 'false'}`,
    '',
  ];
  fs.writeFileSync(ENV_PATH, lines.join('\n'), { mode: 0o600 });
}

// ─── Environment checks ──────────────────────────────────────────────────
function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    fail(`Node.js ${process.versions.node} detected, but this project needs Node 18 or newer.`);
    info('Run the bootstrap script for your OS instead, which will install Node automatically:');
    info('  macOS / Linux:  ./setup.sh');
    info('  Windows:        .\\setup.ps1');
    process.exit(1);
  }
  ok(`Node.js ${process.versions.node} — meets requirement (>=18).`);
}

function ensureDependencies() {
  const nodeModules = path.join(ROOT, 'node_modules');
  const lockFile = path.join(ROOT, 'package-lock.json');
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  const deps = Object.keys(pkg.dependencies || {});

  let needInstall = !fs.existsSync(nodeModules);
  if (!needInstall) {
    for (const d of deps) {
      if (!fs.existsSync(path.join(nodeModules, d))) { needInstall = true; break; }
    }
  }
  if (!needInstall) {
    ok('Dependencies already installed.');
    return;
  }
  info('Installing dependencies (this may take a minute)…');
  const useCi = fs.existsSync(lockFile);
  const r = spawnSync(/^win/i.test(process.platform) ? 'npm.cmd' : 'npm',
    [useCi ? 'ci' : 'install', '--no-audit', '--no-fund'],
    { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    fail('npm install failed. Fix the errors above and run `npm run setup` again.');
    process.exit(1);
  }
  ok('Dependencies installed.');
}

// ─── Main flow ───────────────────────────────────────────────────────────
async function main() {
  banner();
  head('1) Checking your environment');
  checkNodeVersion();
  ensureDependencies();

  head('2) Building your .env');
  const existing = loadEnv(ENV_PATH);
  const fromExample = loadEnv(ENV_EXAMPLE);
  if (fs.existsSync(ENV_PATH)) {
    info('A .env file already exists. We will reuse non-empty values as defaults.');
    const overwrite = await confirm('Continue and update it?', true);
    if (!overwrite) {
      warn('Setup aborted by user.');
      rl.close();
      process.exit(0);
    }
  }

  function pick(key) {
    const v = existing[key];
    if (!v) return '';
    const ph = ['YOUR_ROBLOSECURITY_COOKIE_HERE', 'YOUR_DISCORD_BOT_TOKEN_HERE',
                'YOUR_DISCORD_APPLICATION_ID_HERE', 'YOUR_DISCORD_CHANNEL_ID_HERE'];
    return ph.includes(v) ? '' : v;
  }

  console.log('');
  info(paint(c.dim, 'Need help finding a value? See the credentials section in README.md.'));
  info(paint(c.dim, 'Press Ctrl+C any time to abort. Existing values appear in [brackets] — press Enter to keep them.'));
  console.log('');

  // ROBLOX_COOKIE
  let cookie = '';
  while (!cookie) {
    const def = pick('ROBLOX_COOKIE');
    cookie = await ask('Roblox .ROBLOSECURITY cookie', {
      defaultValue: def, secret: true,
      validate: validateRobloxCookie,
    });
  }

  // DISCORD_TOKEN
  let discordToken = '';
  let derivedClientId = '';
  while (!discordToken) {
    const def = pick('DISCORD_TOKEN');
    let appId = null;
    discordToken = await ask('Discord bot token', {
      defaultValue: def, secret: true,
      validate: async (v) => {
        const r = await validateDiscordToken(v);
        if (r === true) return true;
        if (typeof r === 'object' && r.applicationId) { appId = r.applicationId; return true; }
        return r;
      },
    });
    if (appId) derivedClientId = appId;
  }

  // DISCORD_CLIENT_ID — auto-derive but let user override
  let clientId = derivedClientId || pick('DISCORD_CLIENT_ID');
  if (clientId) {
    info(`Discord application ID derived from token: ${paint(c.bold, clientId)}`);
    const keep = await confirm('Use that as DISCORD_CLIENT_ID?', true);
    if (!keep) clientId = await ask('Discord application (client) ID', { defaultValue: clientId });
  } else {
    clientId = await ask('Discord application (client) ID');
  }

  // DISCORD_GUILD_ID
  const guildId = await ask(
    'Discord guild ID for instant slash-command registration (optional, blank = global)',
    { defaultValue: pick('DISCORD_GUILD_ID'), validate: validateGuildId },
  );

  // GROUP_ID
  const groupId = await ask('Roblox group ID to track', {
    defaultValue: pick('GROUP_ID'),
    validate: (v) => validateGroupId(v, cookie),
  });

  // CHANNEL_ID
  const channelId = await ask('Discord channel ID to post sales into', {
    defaultValue: pick('CHANNEL_ID'),
    validate: validateChannelId,
  });

  // Optional tuning
  head('3) Optional tuning (press Enter for defaults)');
  const pollSec = await ask('Polling interval in seconds (min 15)', {
    defaultValue: existing.POLL_INTERVAL_SECONDS || fromExample.POLL_INTERVAL_SECONDS || '60',
    validate: (v) => (Number(v) >= 15 ? true : 'Must be 15 or higher to avoid Roblox rate limits.'),
  });
  const color = await ask('Embed color (hex, no #)', {
    defaultValue: existing.EMBED_COLOR || fromExample.EMBED_COLOR || '00B0F4',
    validate: (v) => (/^[0-9a-f]{6}$/i.test(v) ? true : 'Must be a 6-digit hex like 00B0F4.'),
  });
  const recap = await confirm('Post a short startup recap message every time the bot launches?', false);

  // Write .env
  writeEnv({
    ROBLOX_COOKIE: cookie,
    DISCORD_TOKEN: discordToken,
    DISCORD_CLIENT_ID: clientId,
    DISCORD_GUILD_ID: guildId,
    GROUP_ID: groupId,
    CHANNEL_ID: channelId,
    POLL_INTERVAL_SECONDS: pollSec,
    EMBED_COLOR: color,
    SEND_STARTUP_RECAP: recap ? 'true' : 'false',
  });
  ok(`Wrote ${path.relative(process.cwd(), ENV_PATH)} (chmod 600 — readable only by you).`);

  // Optional: register slash commands
  head('4) Slash commands');
  const doRegister = await confirm('Register slash commands now? (You can also do it later with `npm run register`.)', true);
  if (doRegister) {
    const r = spawnSync(/^win/i.test(process.platform) ? 'npm.cmd' : 'npm',
      ['run', 'register'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) warn('Slash command registration failed. You can retry with `npm run register`.');
  }

  // Final step
  head('5) All set');
  ok('Setup complete!');
  console.log(`\nNext steps:`);
  console.log(`  ${paint(c.bold, 'npm start')}    ${paint(c.dim, '— launch the bot')}`);
  console.log(`  ${paint(c.bold, 'npm run dev')}  ${paint(c.dim, '— launch in watch mode (auto-restart on file change)')}`);
  console.log('');

  const launchNow = await confirm('Launch the bot right now?', true);
  rl.close();
  if (launchNow) {
    const npmBin = /^win/i.test(process.platform) ? 'npm.cmd' : 'npm';
    const child = spawn(npmBin, ['start'], { cwd: ROOT, stdio: 'inherit' });
    child.on('close', (code) => process.exit(code ?? 0));
    return;
  }
  process.exit(0);
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
  console.error(err);
  rl.close();
  process.exit(1);
});
