// models/UserProfile.js
const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    username: { type: String, default: "" },

    // Mini-game EP balance on Discord
    botBalance: { type: Number, default: 0 },

    // Reference linking to the Web User collection
    webUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    socialAffinity: [
      {
        targetUserId: { type: String, required: true },
        targetTag: { type: String, default: "" },
        interactionCount: { type: Number, default: 1 },
      },
    ],

    commandTelemetry: {
      type: Map,
      of: Number,
      default: {},
    },

    externalBotsUsed: [
      {
        botName: { type: String, required: true },
        botId: { type: String, required: true },
        count: { type: Number, default: 1 },
        lastUsedAt: { type: Date, default: Date.now },
      },
    ],

    interests: {
      type: [String],
      default: [],
    },

    vibeProfile: {
      type: String,
      default: "Neutral server regular",
    },

    totalInteractions: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.UserProfile ||
  mongoose.model("UserProfile", UserProfileSchema);
