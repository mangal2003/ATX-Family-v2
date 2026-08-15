const mongoose = require("mongoose");

const xplSeasonSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true, unique: true },
    seasonRoman: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "registration", "auction", "active", "ended"],
      default: "draft",
    },
    registrationDeadline: { type: Date, default: null },
    isRegistrationOpen: { type: Boolean, default: false },

    // Live Auction State and Controls
    auctionState: {
      status: {
        type: String,
        enum: ["idle", "countdown", "live", "paused", "break", "ended"],
        default: "idle",
      },
      auctionCoordinators: [
        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      ],
      currentNominatedPlatoId: { type: String, default: null },
      currentNominatedPlayerName: { type: String, default: null },
      currentBid: { type: Number, default: 0 },
      highestBidderTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "XplTeam",
        default: null,
      },
      bidHistory: { type: Array, default: [] },
    },
    championTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "XplTeam",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.XplSeason || mongoose.model("XplSeason", xplSeasonSchema);
