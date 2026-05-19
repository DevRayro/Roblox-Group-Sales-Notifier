// src/discord/commands.js
// Slash command definitions + handlers.

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getClient } = require('../roblox/client');
const { buildStatsEmbed } = require('./embeds');
const config = require('../config');

const definitions = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check that the bot is alive and how slow Discord is feeling.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show sales totals tracked by this bot.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('lastsales')
    .setDescription('Show the most recent group sales.')
    .addIntegerOption((o) =>
      o.setName('count').setDescription('How many to show (1–10).').setMinValue(1).setMaxValue(10),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('group')
    .setDescription('Show information about the tracked Roblox group.')
    .toJSON(),
];

function makeHandlers({ getState }) {
  return {
    async ping(interaction) {
      const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true, flags: MessageFlags.Ephemeral });
      const rtt = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply(
        `🏓 Pong! Round-trip: \`${rtt}ms\` · WebSocket: \`${Math.round(interaction.client.ws.ping)}ms\``,
      );
    },

    async stats(interaction) {
      await interaction.deferReply();
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let groupName = null;
      let currency = null;
      let today = { count: 0, robux: 0 };
      let last7d = { count: 0, robux: 0 };

      try {
        const info = await getClient().getGroupInfo(config.groupId);
        groupName = info?.name;
      } catch { /* ignore */ }
      try {
        currency = await getClient().getGroupCurrency(config.groupId);
      } catch { /* ignore */ }

      try {
        const week = await getClient().aggregateSalesSince(config.groupId, sevenDaysAgo);
        last7d = { count: week.count, robux: week.robux };
        for (const tx of week.transactions) {
          const ts = tx.created ? new Date(tx.created).getTime() : 0;
          if (ts >= startOfToday.getTime()) {
            today.count += 1;
            today.robux += Number(tx.currency?.amount) || 0;
          }
        }
      } catch (err) {
        await interaction.editReply(`Could not pull live stats from Roblox: \`${err.message}\``);
        return;
      }

      await interaction.editReply({
        embeds: [buildStatsEmbed({ groupName, last7d, today, currency })],
      });
    },

    async lastsales(interaction) {
      await interaction.deferReply();
      const count = interaction.options.getInteger('count') ?? 5;
      try {
        const res = await getClient().getGroupTransactions(config.groupId, {
          transactionType: 'Sale',
          limit: Math.max(10, count),
          sortOrder: 'Desc',
        });
        const txs = (res?.data || []).slice(0, count);
        if (!txs.length) {
          await interaction.editReply('No recent sales found.');
          return;
        }
        const lines = txs.map((t) => {
          const when = t.created ? `<t:${Math.floor(new Date(t.created).getTime() / 1000)}:R>` : '';
          const buyer = t.agent?.name ? `[${t.agent.name}](https://www.roblox.com/users/${t.agent.id}/profile)` : 'Unknown';
          const item = t.details?.name || 'Unknown';
          const amount = (t.currency?.amount ?? 0).toLocaleString('en-US');
          return `• **${item}** — ${amount} R$ — by ${buyer} ${when}`;
        });
        const embed = new EmbedBuilder()
          .setTitle(`🧾 Last ${txs.length} sales`)
          .setColor(parseInt(config.embedColor, 16) || 0x00b0f4)
          .setDescription(lines.join('\n'))
          .setTimestamp(new Date());
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply(`Failed to fetch transactions: \`${err.message}\``);
      }
    },

    async group(interaction) {
      await interaction.deferReply();
      try {
        const info = await getClient().getGroupInfo(config.groupId);
        const embed = new EmbedBuilder()
          .setTitle(info.name || `Group ${config.groupId}`)
          .setURL(`https://www.roblox.com/groups/${config.groupId}`)
          .setColor(parseInt(config.embedColor, 16) || 0x00b0f4)
          .setDescription(info.description?.slice(0, 1024) || '_No description_')
          .addFields(
            { name: 'ID', value: `\`${config.groupId}\``, inline: true },
            { name: 'Members', value: `${info.memberCount?.toLocaleString('en-US') ?? '?'}`, inline: true },
            { name: 'Owner', value: info.owner?.username ? `[@${info.owner.username}](https://www.roblox.com/users/${info.owner.userId}/profile)` : '—', inline: true },
          );
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply(`Failed to fetch group info: \`${err.message}\``);
      }
    },
  };
}

module.exports = { definitions, makeHandlers };
