# Deploying to Northflank (free, 24/7, GitHub auto-deploy)

This bot runs free on **Northflank's Sandbox tier** with always-on compute (no sleep) and push-to-deploy from GitHub. No credit card required for the Sandbox tier.

> One-time setup is browser-based. Once it's done, every push to `main` redeploys the bot automatically.

---

## Step 1 — Sign up

1. Go to <https://app.northflank.com/signup>.
2. Click **Continue with GitHub** so the integration is wired up automatically.
3. Skip any "invite teammates" / "connect cloud" steps. The default Northflank-managed cloud is what we want.

## Step 2 — Create the project

1. Click **Create new project**.
2. Name it `roblox-sales-notifier` (or whatever you like).
3. Region: pick **Europe (Frankfurt)** or **US East** depending on where you are. Frankfurt is closer to Roblox's EU edge.
4. Click **Create project**.

## Step 3 — Create the service

1. Inside the project, click **Create new service**.
2. Service type: **Combined service** (build + deploy in one).
3. Source:
   - **Repository**: `DevRayro/Roblox-Group-Sales-Notifier`
   - **Branch**: `main`
   - **Build context**: `/` (default)
4. Build settings:
   - **Build type**: `Dockerfile`
   - **Dockerfile path**: `Dockerfile`
5. Resources:
   - Pick the **`nf-compute-20`** preset (0.2 vCPU, 512 MB RAM). The Sandbox tier covers it for free. 256 MB also works but discord.js is happier with 512.
6. Ports & networking:
   - **Leave all ports off**. This is a worker, not an HTTP service.
7. Persistent storage:
   - Click **Add volume** → mount path `/app/data`, size `1 GB`. This keeps the last-seen-transaction state across redeploys.
8. **Continuous deployment**: leave **Enabled** (default). This is what triggers a rebuild on every `git push`.

Don't click "Create" yet — we still need the secrets.

## Step 4 — Add the secrets

Scroll down to the **Environment variables** section and add these. Use the **secret** type for the cookie and tokens (Northflank masks them in logs and the UI).

| Key | Value | Type |
|---|---|---|
| `ROBLOX_COOKIE` | _your `.ROBLOSECURITY` value_ | secret |
| `DISCORD_TOKEN` | _your bot token_ | secret |
| `DISCORD_CLIENT_ID` | _your application ID_ | normal |
| `DISCORD_GUILD_ID` | _empty, or your guild ID for instant slash-command registration_ | normal |
| `GROUP_ID` | _your Roblox group ID_ | normal |
| `CHANNEL_ID` | _your Discord channel ID_ | normal |
| `POLL_INTERVAL_SECONDS` | `60` | normal |
| `EMBED_COLOR` | `00B0F4` | normal |
| `SEND_STARTUP_RECAP` | `true` | normal |

> Tip: open your local `.env` file, copy each value over. **Never paste your `.env` directly into a public chat or commit it to git** — `.gitignore` already excludes it.

## Step 5 — Click create

Click **Create service**. Northflank pulls the repo, builds the Dockerfile, and starts the container. First build takes ~2–4 minutes. You'll see the same log output you saw locally:

```
============================================================
  Roblox Group Sales Notifier  -  v2.0.0
============================================================
· INFO  | Authenticated as Zeqwrt (...).
· INFO  | Tracking group: japannn (...) · 263 members.
✓ INFO  | Registered 4 global slash commands ...
· INFO  | Logged into Discord as Ray Roblox Sales#...
· INFO  | Polling group ... every 60s for new sales.
```

If you set `SEND_STARTUP_RECAP=true`, the channel gets a welcome embed.

## Step 6 — Verify auto-deploy works

Make any small change locally, commit, push:

```bash
git commit -am "test: redeploy"
git push origin main
```

Within ~30 seconds Northflank's GitHub webhook fires, the build kicks off, and the bot rolls over to the new version once the build is healthy. You can watch it live under the **Builds** tab.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Roblox returned 401 Unauthorized` in logs | The `.ROBLOSECURITY` cookie expired. Update `ROBLOX_COOKIE` in the **Secrets** section and Northflank will redeploy. |
| Build fails with `npm ci` errors | Make sure `package-lock.json` is committed. `npm ci` requires it. |
| Bot reposts old sales after a redeploy | The `/app/data` volume isn't mounted, so `state.json` resets. Re-check Step 3.7. |
| Slash commands don't show up | Set `DISCORD_GUILD_ID` to your test server's ID for instant propagation. |
| Build runs out of memory | Bump the compute preset to `nf-compute-50` (1 GB). Still inside the free Sandbox tier. |

## Migrating to another host later

The Dockerfile in the repo root is a vanilla container, so the same image works on Fly.io, Railway, Render, Koyeb, or any other Docker-compatible host. Only the platform-specific config (Northflank service settings) is bespoke.
