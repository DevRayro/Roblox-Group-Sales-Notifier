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

  const description = [
    `**Buyer:** [${displayName} (@${buyerName})](https://www.roblox.com/users/${buyerId}/profile)`,
    `**User ID:** \`${buyerId}\``,
    `**Item:** ${assetId ? `[${productName}](https://www.roblox.com/catalog/${assetId})` : productName}`,
    `**Earned:** ${fmtRobux(amount)}`,
    tx.isPending ? '_pending_' : null,
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('New group sale')
    .setURL(buyerId ? `https://www.roblox.com/users/${buyerId}/profile` : null)
    .setDescription(description)
    .setColor(COLOR)
    .setTimestamp(created)
    .setFooter({ text: 'Roblox Group Sales Notifier' });

  if (headshotUrl) embed.setThumbnail(headshotUrl);
  if (productThumbUrl) embed.setImage(productThumbUrl);
  return embed;
}

function buildStatsEmbed({ groupName, last7d, today, currency }) {
  const lines = [
    `**Today:** ${today.count} sales · ${fmtRobux(today.robux)}`,
    `**Last 7 days:** ${last7d.count} sales · ${fmtRobux(last7d.robux)}`,
  ];
  if (currency) {
    lines.push('');
    lines.push(`**Group Robux balance:** ${fmtRobux(currency.robux ?? 0)}`);
  }
  return new EmbedBuilder()
    .setTitle(`Sales Stats${groupName ? ` — ${groupName}` : ''}`)
    .setColor(COLOR)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date())
    .setFooter({ text: 'Roblox Group Sales Notifier' });
}

function buildStartupEmbed({ groupName, groupId, last7d }) {
  return new EmbedBuilder()
    .setTitle('Sales Notifier online')
    .setColor(COLOR)
    .setDescription([
      `Tracking group **${groupName || groupId}** (\`${groupId}\`).`,
      `Last 7 days: **${last7d.count} sales** · **${fmtRobux(last7d.robux)}**.`,
      'New sales will be posted here in real time.',
    ].join('\n'))
    .setTimestamp(new Date())
    .setFooter({ text: 'Roblox Group Sales Notifier' });
}

module.exports = { buildSaleEmbed, buildStatsEmbed, buildStartupEmbed };
