const mongoose = require("mongoose");

const xplRegistrationSchema = new mongoose.Schema(
  {
    seasonNumber: {
      type: Number,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    platoId: {
      type: String,
      required: true,
      trim: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    preferredGames: {
      type: String,
      default: "",
    },
    aboutPlayer: {
      type: String,
      default: "",
    },
    basePrice: {
      type: Number,
      default: 100,
    },
    // Direct team name string (from migration & legacy auctions)
    boughtBy: {
      type: String,
      default: null,
    },
    // Final bid/sale price
    soldPrice: {
      type: Number,
      default: null,
    },
    // ObjectId reference (for current/future dynamic season models)
    soldToTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "XplTeam",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "sold", "unsold"],
      default: "pending",
    },
    registeredByAdmin: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// MongoDB level unique constraint per user/email per season
xplRegistrationSchema.index(
  { seasonNumber: 1, userEmail: 1 },
  { unique: true, sparse: true },
);

module.exports = mongoose.model("XplRegistration", xplRegistrationSchema);
