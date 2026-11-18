const express = require("express");
const router = express.Router();
const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const DiscordUser = require("../models/DiscordUser");
const { ensureAuth } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");

// GET /profile - Render Profile Page with Combined EP
router.get("/profile", ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Fetch total botBalance from DiscordUser
    let totalBotBalance = user.xpBalance || 0;
    let isLinked = false;

    if (user.discordId) {
      const dcUser =
        (await DiscordUser.findOne({ discordId: user.discordId })) || null;
      if (dcUser) {
        totalBotBalance = dcUser.botBalance; // Single total stored in botBalance
        isLinked = true;
      }
    }

    res.render("profile", {
      title: `${user.username}'s Profile | ATX`,
      user,
      totalBotBalance,
      isLinked,
    });
  } catch (err) {
    console.error("[PROFILE LOAD ERROR]:", err);
    res.redirect("/");
  }
});

// POST /profile/generate-connect-code
router.post("/profile/generate-connect-code", ensureAuth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        connectionCode: code,
        codeExpiresAt: expiresAt,
      },
    });

    res.json({ success: true, code, expiresAt });
  } catch (err) {
    console.error("[CONNECT CODE ERROR]:", err);
    res
      .status(500)
      .json({ success: false, message: "Could not generate link code." });
  }
});

// POST /profile/update - Update Username, Plato ID, Discord ID, & Bio
router.post("/profile/update", ensureAuth, async (req, res) => {
  try {
    const { username, platoId, discordId, bio } = req.body;

    const cleanUsername = username ? username.trim() : "";
    if (!cleanUsername || cleanUsername.length < 3) {
      req.flash("error_msg", "Username must be at least 3 characters long.");
      return res.redirect("/profile");
    }

    let cleanPlatoId = platoId ? platoId.trim() : "";
    if (cleanPlatoId) {
      const platoRegex = /^[a-zA-Z0-9_]{1,12}$/;
      if (!platoRegex.test(cleanPlatoId)) {
        req.flash(
          "error_msg",
          "Plato ID must be 1 to 12 characters and contain only letters, numbers, and underscores.",
        );
        return res.redirect("/profile");
      }
    }

    const existingUser = await User.findOne({
      username: cleanUsername,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      req.flash("error_msg", "Username is already taken by another user.");
      return res.redirect("/profile");
    }

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        username: cleanUsername,
        platoId: cleanPlatoId,
        discordId: discordId ? discordId.trim() : "",
        bio: bio ? bio.trim() : "",
      },
    });

    req.flash("success_msg", "Profile updated successfully!");
    res.redirect("/profile");
  } catch (err) {
    console.error("[PROFILE UPDATE ERROR]", err);
    req.flash("error_msg", "Error updating profile details.");
    res.redirect("/profile");
  }
});

// POST /profile/avatar - Update Profile Picture
router.post(
  "/profile/avatar",
  ensureAuth,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        req.flash("error_msg", "Please select an image file for avatar.");
        return res.redirect("/profile");
      }

      await User.findByIdAndUpdate(req.user._id, {
        $set: {
          avatar: req.file.path,
          isCustomAvatar: true,
        },
      });

      req.flash("success_msg", "Profile picture updated successfully!");
      res.redirect("/profile");
    } catch (err) {
      console.error(err);
      req.flash("error_msg", "Failed to update avatar.");
      res.redirect("/profile");
    }
  },
);

// POST /profile/banner - Update Profile Banner
router.post(
  "/profile/banner",
  ensureAuth,
  upload.single("banner"),
  async (req, res) => {
    try {
      if (!req.file) {
        req.flash("error_msg", "Please select an image file for banner.");
        return res.redirect("/profile");
      }

      await User.findByIdAndUpdate(req.user._id, {
        $set: {
          banner: req.file.path,
        },
      });

      req.flash("success_msg", "Profile banner updated successfully!");
      res.redirect("/profile");
    } catch (err) {
      console.error(err);
      req.flash("error_msg", "Failed to update banner.");
      res.redirect("/profile");
    }
  },
);

module.exports = router;
