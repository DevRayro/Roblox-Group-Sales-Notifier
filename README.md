<div align="center">

# Roblox Group Sales Notifier

A modern Discord bot that posts a rich notification every time someone buys something from your Roblox group, with built-in stats, slash commands, and crash-safe state persistence.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## Features

- Real-time sale notifications in any Discord channel.
- Rich embeds with buyer headshot, item thumbnail, price, and direct profile/catalog links.
- State persistence — restarting the bot will not re-spam old transactions.
- Live stats pulled directly from Roblox: today and last-7-days totals via `/stats`.
- Slash commands: `/ping`, `/stats`, `/lastsales`, `/group`.
- Robust API client with auto X-CSRF refresh and clear 401/403/429 error messages.
- Modular `src/` layout that is easy to extend.
- No deprecated dependencies — `noblox.js` was archived in March 2026, so this version talks to Roblox APIs directly.
- `.env`-based config with a sane fallback to `config.json`.

---

## Installation

Pick the option that matches your setup. Most people want the first one.

<details>
<summary><b>Easiest: one-click installer</b></summary>

The installer detects your OS, installs or upgrades Node.js if needed, runs `npm install`, then walks you through every credential with **live validation against Roblox and Discord**. You cannot save a wrong value.

<details>
<summary><b>Windows (double-click)</b></summary>

1. [Download this repo as a ZIP](https://github.com/DevRayro/Roblox-Group-Sales-Notifier/archive/refs/heads/main.zip) and unzip it, **or** clone with git:
   ```
   git clone https://github.com/DevRayro/Roblox-Group-Sales-Notifier.git
   ```
2. Open the folder.
3. Double-click **`setup.bat`**.
4. Follow the prompts. Done.

If Windows SmartScreen warns you, click **More info → Run anyway**. The script is plain text — open it in Notepad first if you want to read it.

</details>

<details>
<summary><b>Windows (PowerShell, scripted)</b></summary>

```powershell
git clone https://github.com/DevRayro/Roblox-Group-Sales-Notifier.git
cd Roblox-Group-Sales-Notifier
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
```

</details>

<details>
<summary><b>macOS / Linux</b></summary>

```bash
git clone https://github.com/DevRayro/Roblox-Group-Sales-Notifier.git
cd Roblox-Group-Sales-Notifier
chmod +x setup.sh
./setup.sh
```

The script tries Homebrew, apt, dnf, pacman, then nvm — whichever your system has — to install Node 18+ if it is missing.

</details>

What the wizard does:

1. Verifies Node.js 18+ (and installs/upgrades it if missing).
2. Runs `npm install`.
3. Prompts for the Roblox cookie (input is hidden) and verifies it against `users.roblox.com`.
4. Prompts for the Discord bot token (hidden) and verifies it against `discord.com/api`. The application ID is auto-derived from the token.
5. Prompts for the group ID and confirms the group exists.
6. Prompts for the channel ID and validates the snowflake format.
7. Asks about optional tuning (poll interval, embed color, startup recap).
8. Writes `.env` with `chmod 600` so only you can read it.
9. Optionally registers slash commands and launches the bot.

</details>

<details>
<summary><b>Manual install</b></summary>

Requires [Node.js 18+](https://nodejs.org/) installed already.

```bash
git clone https://github.com/DevRayro/Roblox-Group-Sales-Notifier.git
cd Roblox-Group-Sales-Notifier
npm install
cp .env.example .env
# edit .env in any editor, then:
npm start
```

If you prefer not to use `.env`, you can edit `config.json` instead. Values from `.env` always win over `config.json`.

</details>

---

## Configuration

<details>
<summary><b>How to get every credential</b></summary>

<details>
<summary><b>Discord bot token and client ID</b></summary>

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Under **Bot**, click **Reset Token** and copy it. This is your `DISCORD_TOKEN`.
3. Under **General Information**, copy the **Application ID**. This is your `DISCORD_CLIENT_ID`.
4. Under **Installation** (or the older OAuth2 → URL Generator), pick scopes `bot` + `applications.commands`, give the bot `Send Messages` and `Embed Links`, and use the generated URL to invite the bot to your server.

The setup wizard auto-derives the client ID from the bot token, so you usually do not need to copy it separately.

</details>

<details>
<summary><b>Discord channel ID</b></summary>

1. In Discord, open **Settings → Advanced** and enable **Developer Mode**.
2. Right-click the channel where sales should be posted, then **Copy Channel ID**.
3. Paste it into `CHANNEL_ID`.

</details>

<details>
<summary><b>Roblox group ID</b></summary>

1. Open your group page on roblox.com.
2. The URL looks like `https://www.roblox.com/groups/12345678/...` — the number is your `GROUP_ID`.

</details>

<details>
<summary><b>.ROBLOSECURITY cookie</b></summary>

> Treat this cookie like a password. Anyone with it has full access to your account. Use a dedicated Roblox account if possible, and never commit `.env` to git.

1. Log into the Roblox account that has permission to view group transactions (the group owner, ideally).
2. Open DevTools (F12) → **Application** tab → **Cookies → https://www.roblox.com**.
3. Copy the value of `.ROBLOSECURITY` and paste it into `ROBLOX_COOKIE`.

The cookie expires periodically. If the bot starts logging `401 Unauthorized`, refresh it the same way.

</details>

</details>

<details>
<summary><b>Configuration reference</b></summary>

All values can be set via `.env` (recommended) or `config.json`. `.env` overrides `config.json`.

| Key | Required | Default | Description |
|---|---|---|---|
| `ROBLOX_COOKIE` | yes | — | Your `.ROBLOSECURITY` cookie. |
| `DISCORD_TOKEN` | yes | — | The bot token from the Developer Portal. |
| `DISCORD_CLIENT_ID` | recommended | — | The application ID. Required to register slash commands. |
| `DISCORD_GUILD_ID` | optional | empty | If set, slash commands register instantly to that guild. If empty, registers globally (~1h propagation). |
| `GROUP_ID` | yes | — | The Roblox group ID to monitor. |
| `CHANNEL_ID` | yes | — | The Discord channel ID to post sales into. |
| `POLL_INTERVAL_SECONDS` | optional | `60` | Polling interval. Minimum 15s to avoid rate limits. |
| `EMBED_COLOR` | optional | `00B0F4` | Hex color for embeds (no `#`). |
| `SEND_STARTUP_RECAP` | optional | `false` | If `true`, posts a recap message when the bot starts. |

For backwards compatibility, the original v1 keys (`ROBLOX_TOKEN`, `BOT_TOKEN`) are still accepted as aliases.

</details>

---

## Usage

<details>
<summary><b>Slash commands</b></summary>

| Command | Description |
|---|---|
| `/ping` | Health check and latency. |
| `/stats` | Today's and last-7-days totals (live from Roblox), plus current group Robux balance. |
| `/lastsales [count]` | Show the most recent sales (1–10). |
| `/group` | Show info about the tracked Roblox group. |

Slash commands register automatically on first start. To re-register manually:

```bash
npm run register
```

</details>

<details>
<summary><b>Running the bot</b></summary>

```bash
npm start         # normal run
npm run dev       # auto-restart on file change
npm run setup     # re-run the interactive wizard
npm run register  # register slash commands without launching the bot
```

</details>

<details>
<summary><b>Project structure</b></summary>

```
.
├── setup.bat                 # Windows one-click installer
├── setup.sh                  # macOS/Linux bootstrap
├── setup.ps1                 # Windows PowerShell bootstrap
├── scripts/
│   └── setup.js              # Interactive wizard (validated prompts, secret masking)
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Loads .env / config.json + validation
│   ├── discord/
│   │   ├── bot.js            # Discord client + slash command routing
│   │   ├── commands.js       # Slash command definitions and handlers
│   │   └── embeds.js         # Embed builders
│   ├── roblox/
│   │   ├── client.js         # Direct Roblox API client (axios)
│   │   └── poller.js         # Polls group transactions, emits new sales
│   ├── scripts/
│   │   └── registerCommands.js
│   └── utils/
│       ├── logger.js
│       └── state.js          # Persists last-seen transaction
├── data/                     # Auto-created at runtime
├── .env.example
├── config.json
└── package.json
```

</details>

---

## Troubleshooting

<details>
<summary><b>Common errors and fixes</b></summary>

| Symptom | Likely cause / fix |
|---|---|
| `ROBLOX_COOKIE is missing or still set to a placeholder` | You didn't fill in `.env`, or the value is still the placeholder. |
| `Roblox returned 401 Unauthorized` | Your cookie is invalid or expired. Refresh it from your browser. |
| `Roblox returned 403 Forbidden` | The Roblox account doesn't have permission to view that group's transactions. Use the owner account or grant the right group permission. |
| `Could not fetch channel … Check CHANNEL_ID and bot permissions` | The bot is not in the server, or doesn't have `View Channel` + `Send Messages` + `Embed Links` on that channel. |
| `Rate limited by Roblox` | Increase `POLL_INTERVAL_SECONDS` (try 90 or 120). |
| Slash commands don't show up | Set `DISCORD_GUILD_ID` for instant registration. Global commands can take up to ~1 hour. |
| Bot posts every sale again after restart | Make sure the `data/` folder is writable so `state.json` can be persisted. |

Set `DEBUG=1` before starting for extra-verbose logging:

```bash
DEBUG=1 npm start
```

</details>

<details>
<summary><b>Migrating from v1</b></summary>

The previous version used the now-deprecated [`noblox.js`](https://noblox.js.org/) (archived March 2026). If you were running v1:

1. Pull the latest code.
2. Run `npm install` again.
3. Either rename your old config keys to the new ones in `.env`, or just keep `config.json` — the legacy keys (`ROBLOX_TOKEN`, `BOT_TOKEN`) are still accepted.
4. Run `npm start`.

No more `setCookie`, no more deprecated streaming events.

</details>

---

## Contributing

PRs are welcome. Some ideas worth tackling:

- Multi-group / multi-channel support
- Webhook-only mode (no bot user needed)
- SQLite-backed state and richer per-buyer analytics
- Localization

Open an issue first for larger changes so we can discuss the approach.

---

## License

MIT — see [LICENSE](LICENSE).

<sub>Made by [DevRayro](https://github.com/DevRayro). If this saved you time, consider [following me on Roblox](https://rblx.name/1667282355).</sub>
