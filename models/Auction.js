// models/Auction.js
const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { type: String, required: true },
  platoId: { type: String, default: "" }, // Added: stores platoId snapshot
  amount: { type: Number, required: true },
  outbiddedUser: { type: String, default: null }, // Stores platoId/username of outbidded user
  createdAt: { type: Date, default: Date.now },
});

const auctionSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    itemImage: { type: String, required: true },
    description: { type: String, default: "" },
    startingBid: { type: Number, default: 100 },
    currentHighestBid: { type: Number, default: 0 },
    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    winnerUsername: { type: String, default: null }, // Kept optional for fallback
    winningBidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    endsAt: { type: Date, required: true },
    bids: [bidSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Auction", auctionSchema);
