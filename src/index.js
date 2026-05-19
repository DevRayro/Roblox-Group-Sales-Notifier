// src/index.js
// Main entry point. Wires up the Roblox poller and the Discord bot.

const config = require('./config');
const logger = require('./utils/logger');
const stateUtil = require('./utils/state');
const { getClient } = require('./roblox/client');
const { TransactionPoller } = require('./roblox/poller');
const { DiscordBot } = require('./discord/bot');
const { buildSaleEmbed, buildStartupEmbed } = require('./discord/embeds');

async function main() {
  console.log('');
  console.log('  ============================================================');
  console.log('    Roblox Group Sales Notifier  -  v2.0.0');
  console.log('    github.com/DevRayro/Roblox-Group-Sales-Notifier');
  console.log('  ============================================================');
  console.log('');

  const errors = config.validate();
  if (errors.length) {
    logger.error('Configuration is invalid:');
    for (const e of errors) console.error(`   • ${e}`);
    console.error('\nFix the values in .env (preferred) or config.json and try again.');
    process.exit(1);
  }

  // Verify Roblox cookie before doing anything else.
  let robloxUser;
  try {
    robloxUser = await getClient().whoAmI();
    logger.roblox(`Authenticated as ${robloxUser.name} (${robloxUser.id}).`);
  } catch (err) {
    if (err.response?.status === 401) {
      logger.error('Roblox cookie is invalid or expired. Update ROBLOX_COOKIE in your .env file.');
    } else {
      logger.error('Could not validate Roblox cookie:', err.message);
    }
    process.exit(1);
  }

  // Group existence sanity check.
  let groupInfo = null;
  try {
    groupInfo = await getClient().getGroupInfo(config.groupId);
    logger.roblox(`Tracking group: ${groupInfo.name} (${config.groupId}) · ${groupInfo.memberCount?.toLocaleString('en-US') ?? '?'} members.`);
  } catch (err) {
    logger.warn(`Could not fetch group info for ${config.groupId}:`, err.message);
  }

  const state = stateUtil.load();
  const isFirstRun = !state.lastSeenTransactionId && !state.lastSeenCreated;
  let saving = null;
  const persist = () => {
    if (saving) return;
    saving = setTimeout(() => {
      stateUtil.save(state);
      saving = null;
    }, 250);
  };

  const bot = new DiscordBot({ getState: () => state });
  await bot.registerSlashCommands();
  await bot.login();

  const poller = new TransactionPoller({
    groupId: config.groupId,
    intervalSeconds: config.pollIntervalSeconds,
  });
  poller.primeFromState(state);

  poller.on('progress', (p) => {
    state.lastSeenTransactionId = p.lastSeenTransactionId;
    state.lastSeenCreated = p.lastSeenCreated;
    persist();
  });

  poller.on('sale', async (tx) => {
    const buyerId = tx.agent?.id;
    const amount = tx.currency?.amount ?? 0;
    logger.sale(`${tx.details?.name || 'Item'} — ${amount} R$ — by ${tx.agent?.name || 'unknown'} (${buyerId})`);

    let buyer = null;
    let headshotUrl = null;
    let avatarUrl = null;
    let productThumbUrl = null;
    try {
      if (buyerId) {
        const [info, head, body] = await Promise.allSettled([
          getClient().getUserInfo(buyerId),
          getClient().getUserHeadshot(buyerId, '150x150'),
          getClient().getUserAvatar(buyerId, '420x420'),
        ]);
        if (info.status === 'fulfilled') buyer = info.value;
        if (head.status === 'fulfilled') headshotUrl = head.value;
        if (body.status === 'fulfilled') avatarUrl = body.value;
      }
      if (tx.details?.id) {
        productThumbUrl = await getClient().getAssetThumbnail(tx.details.id, '420x420').catch(() => null);
      }
    } catch (err) {
      logger.warn('Could not enrich sale details:', err.message);
    }

    try {
      await bot.sendToChannel({
        embeds: [buildSaleEmbed({
          tx, buyer, headshotUrl, avatarUrl, productThumbUrl,
          group: { id: config.groupId, name: groupInfo?.name },
        })],
      });
    } catch (err) {
      logger.error('Failed to post sale to Discord:', err.message);
    }
  });

  // Wait for Discord to be fully ready before starting the poller, so the very first
  // batch of notifications can actually be sent.
  bot.client.once(require('discord.js').Events.ClientReady, async () => {
    if (isFirstRun) {
      logger.info('First run detected — establishing a baseline so we only post sales going forward.');
      await poller.primeBaseline();
      stateUtil.save(state);
    }
    if (config.sendStartupRecap) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        let last7d = { count: 0, robux: 0 };
        try {
          const week = await getClient().aggregateSalesSince(config.groupId, sevenDaysAgo);
          last7d = { count: week.count, robux: week.robux };
        } catch (err) {
          logger.warn('Could not fetch 7-day totals for startup recap:', err.message);
        }
        const groupIcon = await getClient().getGroupIcon(config.groupId).catch(() => null);
        await bot.sendToChannel({
          embeds: [buildStartupEmbed({
            groupName: groupInfo?.name,
            groupId: config.groupId,
            groupIcon,
            last7d,
          })],
        });
      } catch (err) {
        logger.warn('Could not send startup recap:', err.message);
      }
    }
    poller.start();
  });

  const shutdown = (sig) => {
    logger.info(`Caught ${sig}, shutting down…`);
    poller.stop();
    stateUtil.save(state);
    bot.client.destroy().finally(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));
  process.on('uncaughtException', (err) => logger.error('Uncaught exception:', err));
}

main().catch((err) => {
  logger.error('Fatal error during startup:', err);
  process.exit(1);
});
