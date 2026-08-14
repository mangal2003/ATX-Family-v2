// routes/auction.js
const express = require("express");
const router = express.Router();
const Auction = require("../models/Auction");
const User = require("../models/User");
const { ensureAdmin } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");
const { checkAndEndAuctions } = require("../services/auctionService");
const { sendAuctionAnnouncement } = require("../services/auctionNotifier");

// GET /auction - Render Bidding Page
router.get("/", async (req, res) => {
  try {
    // End any expired auctions before rendering
    await checkAndEndAuctions();

    const activeAuction = await Auction.findOne({ status: "active" }).populate(
      "highestBidder",
      "username platoId avatar",
    );

    // Populate winner reference with platoId, username, and avatar
    const lastEndedAuction = await Auction.findOne({ status: "ended" })
      .populate("winner", "username platoId avatar")
      .sort({ updatedAt: -1 });

    res.render("auction", {
      title: "Weekly EP Auction | ATX",
      auction: activeAuction,
      lastWinner: lastEndedAuction,
      user: req.user,
    });
  } catch (err) {
    console.error("[AUCTION PAGE ERROR]", err);
    res.redirect("/");
  }
});

// POST /auction/bid - Place regular (+100) or custom bid
router.post("/bid", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash("error_msg", "Please login to place a bid.");
    return res.redirect("/auction");
  }

  try {
    const { bidType, customAmount } = req.body;
    const user = await User.findById(req.user._id);
    const auction = await Auction.findOne({ status: "active" }).populate(
      "highestBidder",
      "username platoId",
    );

    if (!auction) {
      req.flash("error_msg", "No active auction at the moment.");
      return res.redirect("/auction");
    }

    // 1. Prevent consecutive self-outbidding
    if (
      auction.highestBidder &&
      auction.highestBidder._id.toString() === user._id.toString()
    ) {
      req.flash("error_msg", "You are already the highest bidder!");
      return res.redirect("/auction");
    }

    let requestedBid = 0;
    const minIncrement = 100;

    if (bidType === "regular") {
      requestedBid =
        (auction.currentHighestBid || auction.startingBid) + minIncrement;
    } else if (bidType === "custom") {
      requestedBid = Number(customAmount);
    }

    // 2. Validate bid amount
    if (!requestedBid || isNaN(requestedBid)) {
      req.flash("error_msg", "Invalid bid amount.");
      return res.redirect("/auction");
    }

    const requiredMinimum = auction.currentHighestBid
      ? auction.currentHighestBid + minIncrement
      : auction.startingBid;

    if (requestedBid < requiredMinimum) {
      req.flash("error_msg", `Bid must be at least ${requiredMinimum} EP.`);
      return res.redirect("/auction");
    }

    if (user.xpBalance < requestedBid) {
      req.flash("error_msg", "Insufficient EP balance.");
      return res.redirect("/auction");
    }

    const previousBidderName = auction.highestBidder
      ? auction.highestBidder.platoId || auction.highestBidder.username
      : null;

    const newBidObj = {
      user: user._id,
      username: user.username,
      platoId: user.platoId || "",
      amount: requestedBid,
      outbiddedUser: previousBidderName,
      createdAt: new Date(),
    };

    // 3. Atomic update with lock condition
    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: auction._id,
        status: "active",
        $or: [{ highestBidder: { $ne: user._id } }, { highestBidder: null }],
      },
      {
        $set: {
          currentHighestBid: requestedBid,
          highestBidder: user._id,
        },
        $push: {
          bids: {
            $each: [newBidObj],
            $position: 0,
          },
        },
      },
      { returnDocument: "after" },
    );

    if (!updatedAuction) {
      req.flash(
        "error_msg",
        "Another user placed a higher bid just before you! Please try again.",
      );
      return res.redirect("/auction");
    }

    req.flash("success_msg", `Bid placed successfully for ${requestedBid} EP!`);
    res.redirect("/auction");
  } catch (err) {
    console.error("[AUCTION BID ERROR]", err);
    req.flash("error_msg", "Error placing bid.");
    res.redirect("/auction");
  }
});

// POST /auction/admin/create - Admin route to launch a new auction
router.post(
  "/admin/create",
  ensureAdmin,
  upload.single("itemImage"),
  async (req, res) => {
    try {
      const { itemName, description, startingBid } = req.body;

      // End any previously active auctions
      await Auction.updateMany({ status: "active" }, { status: "ended" });

      // Calculate 50 hours from current time
      const now = new Date();
      const endsAt = new Date(now.getTime() + 50 * 60 * 60 * 1000);

      // 1. Assign to const newAuction
      const newAuction = await Auction.create({
        itemName,
        description,
        startingBid: Number(startingBid) || 100,
        currentHighestBid: 0,
        itemImage: req.file ? req.file.path : "",
        endsAt: endsAt,
        status: "active",
      });

      // 2. Dispatch announcement
      await sendAuctionAnnouncement({
        type: "START",
        auction: newAuction,
      });

      req.flash("success_msg", "New 50-hour auction created!");
      res.redirect("/auction");
    } catch (err) {
      console.error("[AUCTION CREATE ERROR]", err);
      req.flash("error_msg", "Failed to create auction.");
      res.redirect("/auction");
    }
  },
);

// POST /auction/admin/end-now - Admin route to end active auction immediately
// POST /auction/admin/end-now - Admin route to end the active auction immediately
router.post("/admin/end-now", ensureAdmin, async (req, res) => {
  try {
    const auction = await Auction.findOne({ status: "active" }).populate(
      "highestBidder",
      "username platoId xpBalance",
    );

    if (!auction) {
      req.flash("error_msg", "No active auction found to end.");
      return res.redirect("/auction");
    }

    // 1. Declare variables at the route level
    let winnerId = null;
    let winnerName = null;
    let winningAmount = 0;

    // 2. Process Winning Bidder & Deduct Balance
    if (auction.highestBidder) {
      winnerId = auction.highestBidder._id;
      winnerName =
        auction.highestBidder.platoId || auction.highestBidder.username;
      winningAmount = auction.currentHighestBid || 0;

      await User.findByIdAndUpdate(winnerId, {
        $inc: { xpBalance: -winningAmount },
      });
    }

    // 3. Update Auction Fields
    auction.status = "ended";
    auction.winner = winnerId;
    auction.winnerUsername = winnerName;
    auction.winningBidAmount = winningAmount;
    auction.endsAt = new Date();

    await auction.save();

    // 4. Dispatch Bot Announcement
    await sendAuctionAnnouncement({
      type: "END",
      auction: auction,
      winnerName: winnerName,
      winningBid: winningAmount,
    });

    req.flash(
      "success_msg",
      `Auction manually ended! Winner: ${
        winnerName ? winnerName : "None"
      } | Amount: ${winningAmount.toLocaleString()} EP deducted.`,
    );
    res.redirect("/auction");
  } catch (err) {
    console.error("[MANUAL AUCTION END ERROR]", err);
    req.flash("error_msg", "Failed to end auction manually.");
    res.redirect("/auction");
  }
});

module.exports = router;
