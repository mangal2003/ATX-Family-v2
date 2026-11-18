// models/DiscordUser.js
const mongoose = require("mongoose");

const discordUserSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, default: null },
    tag: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    serverRoles: [{ type: String }],
    isStaff: { type: Boolean, default: false },

    // The single source of truth for total EP
    botBalance: { type: Number, default: 0, min: 0, index: true },
    lastDailyClaim: { type: Date, default: null },

    gameStats: {
      scrambleWins: { type: Number, default: 0 },
      diceRolls: { type: Number, default: 0 },
      coinFlips: { type: Number, default: 0 },
      totalGamesPlayed: { type: Number, default: 0 },
    },

    chatStats: {
      messageCount: { type: Number, default: 0 },
      aiPromptsCount: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      xp: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: Date.now },
    },

    moderation: {
      isBanned: { type: Boolean, default: false },
      warnings: [
        {
          reason: String,
          moderatorId: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: "discord_users",
    timestamps: true,
    strict: false,
  },
);

module.exports =
  mongoose.models.DiscordUser ||
  mongoose.model("DiscordUser", discordUserSchema);
