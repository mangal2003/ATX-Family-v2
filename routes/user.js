// routes/profile.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { ensureAuth } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");

// GET /profile - Render Profile Page
router.get("/profile", ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render("profile", {
      title: `${user.username}'s Profile | ATX`,
      user,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/profile");
  }
});

// POST /profile/update - Update Username, Plato ID, Discord ID, & Bio
router.post("/profile/update", ensureAuth, async (req, res) => {
  try {
    const { username, platoId, discordId, bio } = req.body;

    // 1. Validate Username
    const cleanUsername = username ? username.trim() : "";
    if (!cleanUsername || cleanUsername.length < 3) {
      req.flash("error_msg", "Username must be at least 3 characters long.");
      return res.redirect("/profile");
    }

    // 2. Validate Plato ID (Max 12 chars, only letters, numbers, and underscores)
    let cleanPlatoId = platoId ? platoId.trim() : "";
    if (cleanPlatoId) {
      const platoRegex = /^[a-zA-Z0-9_]{1,12}$/;
      if (!platoRegex.test(cleanPlatoId)) {
        req.flash(
          "error_msg",
          "Plato ID must be 1 to 12 characters and contain only letters, numbers, and underscores (no spaces or special characters).",
        );
        return res.redirect("/profile");
      }
    }

    // 3. Check if Username is already taken by another user
    const existingUser = await User.findOne({
      username: cleanUsername,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      req.flash("error_msg", "Username is already taken by another user.");
      return res.redirect("/profile");
    }

    // 4. Update Profile
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
