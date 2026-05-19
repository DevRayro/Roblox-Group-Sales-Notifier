// src/discord/embeds.js
// Builds rich Discord embeds for sales and stats.

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const COLOR = parseInt(config.embedColor, 16) || 0x00b0f4;

function fmtRobux(n) {
  return `${Number(n || 0).toLocaleString('en-US')} R$`;
}

function relativeTime(date) {
  const ts = Math.floor(date.getTime() / 1000);
  return `<t:${ts}:R>`;
}

function buildSaleEmbed({ tx, buyer, headshotUrl, avatarUrl, productThumbUrl, group }) {
  const buyerId = tx.agent?.id;
  const buyerName = tx.agent?.name || buyer?.name || 'Unknown';
  const displayName = buyer?.displayName || buyerName;
  const profileUrl = buyerId ? `https://www.roblox.com/users/${buyerId}/profile` : null;

  const productName = tx.details?.name || 'Unknown product';
  const assetId = tx.details?.id;
  const assetType = tx.details?.type || 'Item';
  const itemUrl = assetId ? `https://www.roblox.com/catalog/${assetId}` : null;
  const amount = tx.currency?.amount ?? 0;
  const created = tx.created ? new Date(tx.created) : new Date();

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `🛒 ${displayName} (@${buyerName})`,
      iconURL: headshotUrl || undefined,
      url: profileUrl || undefined,
    })
    .setTitle(`💸 New ${assetType} sale${tx.isPending ? '  ·  ⏳ pending' : ''}`)
    .setURL(itemUrl || profileUrl || null)
    .setColor(COLOR)
    .setDescription(itemUrl
      ? `**[${productName}](${itemUrl})** was just purchased.`
      : `**${productName}** was just purchased.`)
    .addFields(
      { name: '💎 Earned', value: `**${fmtRobux(amount)}**`, inline: true },
      { name: '🛍️ Item type', value: `${assetType}`, inline: true },
      { name: '⏱️ When', value: relativeTime(created), inline: true },
      {
        name: '👤 Buyer',
        value: profileUrl
          ? `[${displayName}](${profileUrl})\n\`@${buyerName}\` · ID \`${buyerId}\``
          : `${displayName}\n\`@${buyerName}\``,
        inline: true,
      },
      {
        name: '🏷️ Item',
        value: itemUrl ? `[${productName}](${itemUrl})\nID \`${assetId}\`` : productName,
        inline: true,
      },
      {
        name: '🏛️ Group',
        value: group?.name && group?.id
          ? `[${group.name}](https://www.roblox.com/groups/${group.id})\nID \`${group.id}\``
          : `ID \`${config.groupId}\``,
        inline: true,
      },
    )
    .setTimestamp(created)
    .setFooter({
      text: group?.name ? `Roblox Group Sales Notifier · ${group.name}` : 'Roblox Group Sales Notifier',
      iconURL: 'https://images-ext-1.discordapp.net/external/8ZyHdgFa1CAlF7-c5jOOUe-3M2J9V8h2H6vH7XgE2sw/https/static.rprxy.xyz/favicon.ico',
    });

  // Square avatar on the right (small) for the buyer's "skin".
  if (avatarUrl) embed.setThumbnail(avatarUrl);
  // Big banner image of the item that was sold.
  if (productThumbUrl) embed.setImage(productThumbUrl);
  return embed;
}

function buildStatsEmbed({ groupName, last7d, today, currency }) {
  const lines = [
    `📅 **Today:** ${today.count} sales · ${fmtRobux(today.robux)}`,
    `📈 **Last 7 days:** ${last7d.count} sales · ${fmtRobux(last7d.robux)}`,
  ];
  if (currency) {
    lines.push('');
    lines.push(`💰 **Group Robux balance:** ${fmtRobux(currency.robux ?? 0)}`);
  }
  return new EmbedBuilder()
    .setTitle(`📊 Sales Stats${groupName ? ` — ${groupName}` : ''}`)
    .setColor(COLOR)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date())
    .setFooter({ text: 'Roblox Group Sales Notifier' });
}

function buildStartupEmbed({ groupName, groupId, groupIcon, last7d }) {
  const embed = new EmbedBuilder()
    .setTitle('🟢 Sales Notifier online')
    .setURL(`https://www.roblox.com/groups/${groupId}`)
    .setColor(COLOR)
    .setDescription([
      `🏛️ Tracking **[${groupName || 'group'}](https://www.roblox.com/groups/${groupId})** (\`${groupId}\`).`,
      `📈 Last 7 days: **${last7d.count} sales** · **${fmtRobux(last7d.robux)}**.`,
      '🔔 New sales will be posted here in real time.',
    ].join('\n'))
    .setTimestamp(new Date())
    .setFooter({ text: 'Roblox Group Sales Notifier' });
  if (groupIcon) embed.setThumbnail(groupIcon);
  return embed;
}

module.exports = { buildSaleEmbed, buildStatsEmbed, buildStartupEmbed };
