// src/discord/embeds.js
// Builds rich Discord embeds for sales and stats.

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const COLOR = parseInt(config.embedColor, 16) || 0x00b0f4;

function fmtRobux(n) {
  return `${Number(n || 0).toLocaleString('en-US')} R$`;
}

function buildSaleEmbed({ tx, buyer, headshotUrl, productThumbUrl }) {
  const buyerId = tx.agent?.id;
  const buyerName = tx.agent?.name || buyer?.name || 'Unknown';
  const displayName = buyer?.displayName || buyerName;
  const productName = tx.details?.name || 'Unknown product';
  const assetId = tx.details?.id;
  const amount = tx.currency?.amount ?? 0;
  const created = tx.created ? new Date(tx.created) : new Date();
  const isLimited = tx.isPending === false && (tx.details?.type === 'Asset' || tx.details?.type === 'GamePass');

  const description = [
    `**Buyer:** [${displayName} (@${buyerName})](https://www.roblox.com/users/${buyerId}/profile)`,
    `**User ID:** \`${buyerId}\``,
    `**Item:** ${assetId ? `[${productName}](https://www.roblox.com/catalog/${assetId})` : productName}`,
    `**Earned:** ${fmtRobux(amount)}`,
    tx.isPending ? '`⏳ pending`' : null,
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('💸 New Group Sale')
    .setURL(buyerId ? `https://www.roblox.com/users/${buyerId}/profile` : null)
    .setDescription(description)
    .setColor(COLOR)
    .setTimestamp(created)
    .setFooter({ text: 'Roblox Group Sales Notifier • by DevRayro' });

  if (headshotUrl) embed.setThumbnail(headshotUrl);
  if (productThumbUrl) embed.setImage(productThumbUrl);
  return embed;
}

function buildStatsEmbed({ groupName, allTime, last7d, today, currency }) {
  const lines = [
    `**Today:** ${today.count} sales · ${fmtRobux(today.robux)}`,
    `**Last 7 days:** ${last7d.count} sales · ${fmtRobux(last7d.robux)}`,
    `**All-time (since bot started):** ${allTime.count} sales · ${fmtRobux(allTime.robux)}`,
  ];
  if (currency) {
    lines.push('');
    lines.push(`**Group Robux balance:** ${fmtRobux(currency.robux ?? 0)}`);
  }
  return new EmbedBuilder()
    .setTitle(`📊 Sales Stats${groupName ? ` — ${groupName}` : ''}`)
    .setColor(COLOR)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date())
    .setFooter({ text: 'Roblox Group Sales Notifier' });
}

function buildStartupEmbed({ groupName, groupId, last7d }) {
  return new EmbedBuilder()
    .setTitle('🟢 Sales Notifier Online')
    .setColor(COLOR)
    .setDescription([
      `Tracking group **${groupName || groupId}** (\`${groupId}\`).`,
      `Recent activity (last 7d): **${last7d.count} sales** for **${fmtRobux(last7d.robux)}**.`,
      'New sales will be posted here in real time.',
    ].join('\n'))
    .setTimestamp(new Date())
    .setFooter({ text: 'Roblox Group Sales Notifier' });
}

module.exports = { buildSaleEmbed, buildStatsEmbed, buildStartupEmbed };
