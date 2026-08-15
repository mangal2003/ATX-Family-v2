const express = require("express");
const router = express.Router();
const Auction = require("../models/Auction");
const Feature = require("../models/Feature");
const MusicRoom = require("../models/MusicQueue");
const SiteSetting = require("../models/SiteSetting");
const User = require("../models/User");
const Winner = require("../models/Winner");
const XplSeason = require("../models/XplSeason");

// Function to dynamically compute XPL Status
function getXplStatus() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 4 = May, 10 = Nov, 11 = Dec
  const day = now.getDate();

  // Helper function to convert integer to Roman Numerals (e.g., 4 -> IV)
  const toRoman = (num) => {
    const lookup = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1,
    };
    let roman = "";
    for (let i in lookup) {
      while (num >= lookup[i]) {
        roman += i;
        num -= lookup[i];
      }
    }
    return roman;
  };

  let seasonNum = 1;
  let isLive = false;

  if (month <= 4) {
    // Jan - May -> Targets May Season of current year
    seasonNum = (year - 2025) * 2 + 1;
    if (month === 4 && day >= 1 && day <= 20) isLive = true;
  } else if (month <= 10) {
    // Jun - Nov -> Targets Nov Season of current year
    seasonNum = (year - 2025) * 2 + 2;
    if (month === 10 && day >= 1 && day <= 20) isLive = true;
  } else {
    // Dec -> Targets May Season of next year
    seasonNum = (year - 2025) * 2 + 3;
  }

  return {
    seasonRoman: toRoman(seasonNum),
    seasonNumber: seasonNum,
    isLive: isLive,
  };
}

router.get("/", async (req, res) => {
  try {
    // 1. Fetch Site Settings
    const siteSettings = (await SiteSetting.findOne()) || {};

    // 2. Fetch Features sorted by order
    const features = await Feature.find().sort({ order: 1, createdAt: 1 });

    // 3. Fetch Active/Latest Auction with Bids
    // Populate highestBidder to access user fields like .username
    const activeAuction = await Auction.findOne({ status: "active" })
      .populate("highestBidder", "username avatar") // <--- POPULATE HIGHEST BIDDER HERE
      .populate("bids.user", "username avatar")
      .sort({ createdAt: -1 });

    let latestBids = [];
    if (activeAuction && activeAuction.bids) {
      latestBids = activeAuction.bids.slice(-3).reverse();
    }

    // 4. Fetch Music Lounge State
    const musicRoom = await MusicRoom.findOne({ roomId: "global_lounge" });

    // 5. Fetch Top 3 Leaderboard Users (sorted by weeklyScore)
    const topUsers = await User.find({})
      .select("username weeklyScore avatar")
      .sort({ weeklyScore: -1 })
      .limit(5);

    // 6. Fetch Recent Hall of Fame Winners
    const recentWinners = await Winner.find().sort({ date: -1 }).limit(5);
    // 7. Calculate IST Time & Quiz Schedule (Every even IST hour for 30 mins)
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istDate = new Date(utcMs + 5.5 * 3600000); // UTC+5:30
    const istHours = istDate.getHours();
    const istMinutes = istDate.getMinutes();

    const isEvenHour = istHours % 2 === 0;
    const isQuizActive = isEvenHour && istMinutes < 30;
    const topEpUsers = await User.find({})
      .select("username xpBalance avatar")
      .sort({ xpBalance: -1 })
      .limit(5);
    const xplStatus = getXplStatus();
    // XPL AUCTION
    const activeSeason = await XplSeason.findOne({ status: { $ne: "ended" } });
    const hasActiveAuction = !!activeSeason;

    res.render("index", {
      user: req.user || null,
      siteSettings,
      features,
      activeAuction,
      latestBids,
      currentTrack: musicRoom ? musicRoom.currentTrack : null,
      topUsers,
      recentWinners,
      topEpUsers,
      isQuizActive,
      xplStatus,
      hasActiveAuction,
    });
  } catch (err) {
    console.error("[HOME ROUTE ERROR]:", err);
    // Return HTTP 500 status directly to prevent secondary view lookup errors
    res.status(500).send("Internal Server Error");
  }
});

router.get("/guidelines", (req, res) => {
  res.render("guidelines", {
    title: "ATX Guidelines | ATX",
  });
});

module.exports = router;
