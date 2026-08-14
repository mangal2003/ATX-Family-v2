const mongoose = require("mongoose");

const xplTeamSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true },
    teamName: { type: String, required: true, trim: true },
    teamTag: { type: String, required: true, uppercase: true, trim: true }, // e.g., "ATX", "KGS"
    logoUrl: { type: String, default: "/images/default-team.png" },

    // Team Management
    ownerPlatoId: { type: String, required: true },
    ownerName: { type: String, required: true },

    // Website User IDs authorized to place bids during Live Auction
    authorizedBidders: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Financials
    totalBudget: { type: Number, default: 10000 },
    remainingBudget: { type: Number, default: 10000 },

    // Acquired Players
    roster: [
      {
        platoId: { type: String, required: true },
        playerName: { type: String, required: true },
        boughtPrice: { type: Number, required: true },
        role: { type: String, default: "Player" },
      },
    ],
    isChampion: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("XplTeam", xplTeamSchema);
