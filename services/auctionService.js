// services/auctionService.js
const Auction = require("../models/Auction");
const User = require("../models/User");
const { sendAuctionAnnouncement } = require("./auctionNotifier");

const checkAndEndAuctions = async () => {
  try {
    const expiredAuctions = await Auction.find({
      status: "active",
      endsAt: { $lte: new Date() },
    }).populate("highestBidder", "username platoId xpBalance");

    for (const auction of expiredAuctions) {
      let winnerId = null;
      let winnerName = null;
      let winningAmount = 0;

      if (auction.highestBidder) {
        winnerId = auction.highestBidder._id;
        winnerName =
          auction.highestBidder.platoId || auction.highestBidder.username;
        winningAmount = auction.currentHighestBid || 0;

        // Deduct the winning bid from the user's EP balance
        await User.findByIdAndUpdate(winnerId, {
          $inc: { xpBalance: -winningAmount },
        });
      }

      // Conclude auction atomically
      const updatedAuction = await Auction.findOneAndUpdate(
        { _id: auction._id, status: "active" },
        {
          $set: {
            status: "ended",
            winner: winnerId,
            winnerUsername: winnerName,
            winningBidAmount: winningAmount,
          },
        },
        { returnDocument: "after" },
      );

      // Only dispatch the announcement if this process was the one that closed it
      if (updatedAuction) {
        await sendAuctionAnnouncement({
          type: "END",
          auction: updatedAuction,
          winnerName: winnerName,
          winningBid: winningAmount,
        });
      }
    }
  } catch (err) {
    console.error("[AUCTION SERVICE AUTO-END ERROR]", err);
  }
};

module.exports = { checkAndEndAuctions };
