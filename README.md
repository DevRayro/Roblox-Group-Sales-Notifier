<div align="center">

# 💸 Roblox Group Sales Notifier

A modern Discord bot that posts a rich notification every time someone buys something from your Roblox group, with built-in stats, slash commands, and crash-safe state persistence.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)

</div>

---

## ✨ Features

- 🔔 **Real-time sale notifications** in any Discord channel.
- 🖼️ **Rich embeds** with buyer headshot, item thumbnail, price, and direct profile/catalog links.
- 🧠 **State persistence** — remembers the last sale it saw, so restarting the bot will not re-spam old transactions.
- 📊 **Built-in stats tracking** — daily, last-7-days, and all-time totals.
- ⚡ **Slash commands**: `/ping`, `/stats`, `/lastsales`, `/group`.
- 🔁 **Robust API client** — auto-refreshes the Roblox CSRF token, handles 401/403/429 with clear error messages.
- 🧱 **Modular codebase** — clean `src/` layout, easy to extend.
- 🪶 **No deprecated dependencies** — `noblox.js` was archived in March 2026, so this version talks to Roblox APIs directly via `axios`.
- 🔐 **`.env`-based config** with a sane fallback to `config.json`.

---

## 📋 Requirements

- **Node.js 18 or newer** ([download](https://nodejs.org/))
- A **Roblox account** that has permission to view your group's transactions (group owner, or a role with the right permission).
- A **Discord application + bot** ([create one](https://discord.com/developers/applications)).
- The **group ID** you want to track and the **Discord channel ID** to post into.

---

## 🚀 Quick Start (5 minutes)

```bash
# 1. Clone and enter the project
git clone https://github.com/DevRayro/Roblox-Group-Sales-Notifier.git
cd Roblox-Group-Sales-Notifier

# 2. Install dependencies
npm install

# 3. Create your config file from the template
cp .env.example .env

# 4. Open .env in any editor and fill in the values (see below)
#    Then start the bot:
npm start
```

If you prefer not to use `.env`, you can edit `config.json` instead. Values from `.env` always win over `config.json`.

---

## 🔑 How to get every credential

<details>
<summary><b>1. Discord bot token & client ID</b></summary>

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Under **Bot**, click **Reset Token** and copy it → this is your `DISCORD_TOKEN`.
3. Under **General Information**, copy the **Application ID** → this is your `DISCORD_CLIENT_ID`.
4. Under **Installation** (or the older OAuth2 → URL Generator), pick scopes `bot` + `applications.commands`, give the bot the `Send Messages` and `Embed Links` permissions, and use the generated URL to invite the bot to your server.

</details>

<details>
<summary><b>2. Discord channel ID</b></summary>

1. In Discord, open **Settings → Advanced** and enable **Developer Mode**.
2. Right-click the channel where you want sales posted → **Copy Channel ID**.
3. Paste it into `CHANNEL_ID`.

</details>

<details>
<summary><b>3. Roblox group ID</b></summary>

1. Open your group page on roblox.com.
2. The URL looks like `https://www.roblox.com/groups/12345678/...` — the number is your `GROUP_ID`.

</details>

<details>
<summary><b>4. .ROBLOSECURITY cookie</b></summary>

> ⚠️ **Treat this cookie like a password.** Anyone with it has full access to your account. Use a dedicated Roblox account if possible, and never commit `.env` to git.

1. Log into the Roblox account that has permission to view group transactions (the group owner, ideally).
2. Open DevTools (F12) → **Application** tab → **Cookies → https://www.roblox.com**.
3. Copy the value of `.ROBLOSECURITY` and paste it into `ROBLOX_COOKIE`.

The cookie expires periodically. If the bot starts logging `401 Unauthorized`, refresh it from the same place.

</details>

---

## ⚙️ Configuration reference

All values can be set via `.env` (recommended) or `config.json`. `.env` overrides `config.json`.

| Key | Required | Default | Description |
|---|---|---|---|
| `ROBLOX_COOKIE` | ✅ | — | Your `.ROBLOSECURITY` cookie. |
| `DISCORD_TOKEN` | ✅ | — | The bot token from the Developer Portal. |
| `DISCORD_CLIENT_ID` | ⚠️ | — | The application (client) ID. Required to register slash commands. |
| `DISCORD_GUILD_ID` | ❌ | _(empty)_ | If set, slash commands register instantly to that guild. If empty, registers globally (~1h propagation). |
| `GROUP_ID` | ✅ | — | The Roblox group ID to monitor. |
| `CHANNEL_ID` | ✅ | — | The Discord channel ID to post sales into. |
| `POLL_INTERVAL_SECONDS` | ❌ | `60` | Polling interval. Minimum 15s to avoid rate limits. |
| `EMBED_COLOR` | ❌ | `00B0F4` | Hex color for embeds (no `#`). |
| `SEND_STARTUP_RECAP` | ❌ | `false` | If `true`, posts a small recap message when the bot starts. |

For backwards compatibility, the original v1 keys (`ROBLOX_TOKEN`, `BOT_TOKEN`) are still accepted as aliases for `ROBLOX_COOKIE` and `DISCORD_TOKEN`.

---

## 🤖 Slash commands

| Command | Description |
|---|---|
| `/ping` | Quick health check + latency. |
| `/stats` | Today, last-7-days, and all-time sale totals; current group Robux balance. |
| `/lastsales [count]` | Show the most recent sales (1–10). |
| `/group` | Show info about the tracked Roblox group. |

Slash commands register automatically on first start. To re-register manually:

```bash
npm run register
```

---

## 🗂️ Project structure

```
.
├── src/
│   ├── index.js              # Entry point, wires everything together
│   ├── config.js             # Loads .env / config.json + validation
│   ├── discord/
│   │   ├── bot.js            # Discord client + slash command routing
│   │   ├── commands.js       # Slash command definitions & handlers
│   │   └── embeds.js         # Embed builders (sales, stats, startup)
│   ├── roblox/
│   │   ├── client.js         # Direct Roblox API client (axios)
│   │   └── poller.js         # Polls group transactions, emits new sales
│   ├── scripts/
│   │   └── registerCommands.js  # Standalone slash-command registrar
│   └── utils/
│       ├── logger.js         # Timestamped logger
│       └── state.js          # JSON state persistence + stats
├── data/                     # Auto-created at runtime, holds state.json
├── .env.example
├── config.json
└── package.json
```

---

## 🪲 Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `ROBLOX_COOKIE is missing or still set to a placeholder` | You didn't fill in `.env`, or the value is still `YOUR_ROBLOSECURITY_COOKIE_HERE`. |
| `Roblox returned 401 Unauthorized` | Your cookie is invalid or expired — refresh it from your browser. |
| `Roblox returned 403 Forbidden` | The Roblox account doesn't have permission to view that group's transactions. Use the owner's account or grant the right group permission. |
| `Could not fetch channel … Check CHANNEL_ID and bot permissions` | The bot is not in the server, or doesn't have `View Channel` + `Send Messages` + `Embed Links` permissions on that channel. |
| `Rate limited by Roblox` | Increase `POLL_INTERVAL_SECONDS` (try 90 or 120). |
| Slash commands don't show up | Set `DISCORD_GUILD_ID` for instant registration; global commands can take up to ~1 hour to appear. |
| Bot posts every sale again after restart | Make sure the `data/` folder is writable so `state.json` can be persisted. |

Set `DEBUG=1` before starting for extra-verbose logging:

```bash
DEBUG=1 npm start
```

---

## 🔄 Migrating from v1

The previous version used the now-deprecated [`noblox.js`](https://noblox.js.org/) (archived March 2026). If you were running v1:

1. Pull the latest code.
2. Run `npm install` again.
3. Either rename your old config keys to the new ones in `.env`, or just keep `config.json` — the legacy keys (`ROBLOX_TOKEN`, `BOT_TOKEN`) are still accepted.
4. Run `npm start`. That's it.

No more `setCookie`, no more deprecated streaming events.

---

## 🤝 Contributing

PRs are welcome. Some ideas worth tackling:

- Multi-group / multi-channel support
- Webhook-only mode (no bot user needed)
- SQLite-backed state and richer per-buyer analytics
- Localization

Open an issue first for larger changes so we can discuss the approach.

---

## 📝 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Made with ❤️ by [DevRayro](https://github.com/DevRayro). If this saved you time, consider [following me on Roblox](https://rblx.name/1667282355).

</div>
