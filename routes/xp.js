const express = require("express");
const router = express.Router();
const User = require("../models/User");

const DROP_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour
const XP_REWARD = 100;

router.post("/claim-xp", async (req, res) => {
  // 1. Authentication Guard
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to claim EP.",
    });
  }

  try {
    const now = new Date();
    const cooldownThreshold = new Date(now.getTime() - DROP_INTERVAL_MS);

    // 2. Atomic Find & Update with Cooldown Condition
    // Only matches if lastXpClaim is older than 1 hour OR never claimed before
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        $or: [
          { lastXpClaim: { $lte: cooldownThreshold } },
          { lastXpClaim: null },
          { lastXpClaim: { $exists: false } },
        ],
      },
      {
        $inc: { xp: XP_REWARD, xpBalance: XP_REWARD },
        $set: {
          lastXpClaim: now,
          epNotificationSent: false,
        },
      },
      { returnDocument: "after" },
    );

    // 3. If no document was updated, it's either on cooldown or user not found
    if (!updatedUser) {
      const user = await User.findById(req.user._id).select("lastXpClaim");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      const timePassed = now.getTime() - new Date(user.lastXpClaim).getTime();
      const remainingMs = Math.max(0, DROP_INTERVAL_MS - timePassed);

      return res.status(400).json({
        success: false,
        message: "EP drop is currently on cooldown.",
        nextClaimMs: remainingMs,
      });
    }

    // 4. Return Fresh State to Client
    return res.json({
      success: true,
      message: `Successfully claimed +${XP_REWARD} EP!`,
      newXpBalance: updatedUser.xpBalance ?? updatedUser.xp,
      addedXp: XP_REWARD,
      nextClaimMs: DROP_INTERVAL_MS,
    });
  } catch (err) {
    console.error("[EP CLAIM ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing EP claim.",
    });
  }
});

module.exports = router;
