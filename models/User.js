const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    avatar: { type: String, default: "" },
    isCustomAvatar: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
      required: true,
    },
    adminshipRole: {
      type: String,
      enum: ["Owner", "Admin", "Moderator"],
      default: "Moderator",
    },
    discordId: { type: String, default: "", index: true },
    platoId: { type: String, default: "" },
    bio: { type: String, default: "ATX Team Member" },
    quizzesCompleted: { type: Number, default: 0 },
    weeklyScore: { type: Number, default: 0 },
    lastQuizSlot: { type: String, default: null },
    pushSubscription: { type: Object, default: null },
    banner: { type: String, default: "/images/gc-banner.webp" },
    streak: { type: Number, default: 1 },
    lastLoginDate: { type: Date, default: Date.now },

    // Web Platform EP
    xpBalance: { type: Number, default: 0 },
    lastXpClaim: { type: Date, default: null },
    epNotificationSent: {
      type: Boolean,
      default: false,
    },

    // 6-digit Code for Discord Linking
    connectionCode: {
      type: String,
      default: null,
      index: true,
    },
    codeExpiresAt: {
      type: Date,
      default: null,
    },

    vaultStats: {
      roulettePlaysThisHour: { type: Number, default: 0 },
      coinflipPlaysThisHour: { type: Number, default: 0 },
      dicePlaysThisHour: { type: Number, default: 0 },
      slotsPlaysThisHour: { type: Number, default: 0 },
      blackjackPlaysThisHour: { type: Number, default: 0 },
      lastRouletteHour: { type: Number, default: 0 },
      lastEventClaimHour: { type: Number, default: -1 },
    },
    lastSponsorClaim: { type: Date, default: null },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", UserSchema);
