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

    if (!username || username.trim().length < 3) {
      req.flash("error_msg", "Username must be at least 3 characters long.");
      return res.redirect("/profile");
    }

    // Check if username is taken by another user
    const existingUser = await User.findOne({
      username: username.trim(),
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      req.flash("error_msg", "Username is already taken by another user.");
      return res.redirect("/profile");
    }

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        username: username.trim(),
        platoId: platoId ? platoId.trim() : "",
        discordId: discordId ? discordId.trim() : "",
        bio: bio ? bio.trim() : "",
      },
    });

    req.flash("success_msg", "Profile updated successfully!");
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
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
