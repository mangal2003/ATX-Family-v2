const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Cooldown interval set to 1 hour (3600000 ms)
const DROP_INTERVAL_MS = 1 * 60 * 60 * 1000;
const XP_REWARD = 100; // Set to +50 XP to match front-end UI

/**
 * POST /xp/claim-xp
 * Handles hourly user XP drops and cooldown validation
 */
router.post("/claim-xp", async (req, res) => {
  // 1. Authentication Guard
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to claim XP.",
    });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User account not found." });
    }

    const now = new Date();

    // 2. Validate Cooldown Period
    if (user.lastXpClaim) {
      const timePassed = now.getTime() - new Date(user.lastXpClaim).getTime();

      if (timePassed < DROP_INTERVAL_MS) {
        const remainingMs = DROP_INTERVAL_MS - timePassed;
        return res.status(400).json({
          success: false,
          message: "XP drop is currently on cooldown.",
          nextClaimMs: remainingMs,
        });
      }
    }

    // 3. Update XP Balance and Timestamp
    user.xp = (user.xp || user.xpBalance || 0) + XP_REWARD;
    user.xpBalance = user.xp; // Sync both fields if schema uses either
    user.lastXpClaim = now;

    await user.save();

    // 4. Return Updated State to Client Script
    return res.json({
      success: true,
      message: `Successfully claimed +${XP_REWARD} XP!`,
      newXpBalance: user.xp,
      addedXp: XP_REWARD,
      nextClaimMs: DROP_INTERVAL_MS,
    });
  } catch (err) {
    console.error("[XP CLAIM ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing XP claim.",
    });
  }
});

module.exports = router;
