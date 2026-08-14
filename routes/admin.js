const express = require("express");
const router = express.Router();
const { ensureAdmin } = require("../middleware/auth");
const User = require("../models/User");
const Winner = require("../models/Winner");
const SiteSetting = require("../models/SiteSetting");

// Helper to retrieve or initialize settings singleton
async function getSiteSettings() {
  let settings = await SiteSetting.findOne();
  if (!settings) {
    settings = await SiteSetting.create({
      totalPrizeSponsored: 0,
      discordServerLink: "",
      discordChannelLink: "",
    });
  }
  return settings;
}

// GET /admin/dashboard - Render Main Management Panel
router.get("/dashboard", ensureAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: "admin" });
    const recentWinnersCount = await Winner.countDocuments();
    const settings = await getSiteSettings();

    res.render("admin/dashboard", {
      title: "ATX Admin Panel",
      stats: { totalUsers, adminUsers, recentWinnersCount, settings },
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to load admin dashboard.");
    res.redirect("/");
  }
});

// POST /admin/user/role - Toggle Role (Member <-> Admin)
router.post("/user/role", ensureAdmin, async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    // Prevent self-demotion
    if (userId === req.user._id.toString()) {
      req.flash("error_msg", "You cannot change your own admin role.");
      return res.redirect("/admin/dashboard");
    }

    await User.findByIdAndUpdate(userId, { role: newRole });
    req.flash("success_msg", `User role updated to ${newRole}.`);
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Error updating user role.");
    res.redirect("/admin/dashboard");
  }
});

// GET /admin/members - Member Directory with Robust Search
router.get("/members", ensureAdmin, async (req, res) => {
  try {
    const searchQuery = (req.query.search || "").trim();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;

    // Search across displayName, username, and email fields flexibly
    const filter = searchQuery
      ? {
          $or: [
            { displayName: { $regex: searchQuery, $options: "i" } },
            { username: { $regex: searchQuery, $options: "i" } },
            { email: { $regex: searchQuery, $options: "i" } },
          ],
        }
      : {};

    const totalMembers = await User.countDocuments(filter);
    const membersList = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/members", {
      title: "Manage Members | ATX Admin",
      membersList,
      searchQuery,
      currentPage: page,
      totalPages: Math.ceil(totalMembers / limit) || 1,
    });
  } catch (err) {
    console.error("Member search error:", err);
    req.flash("error_msg", "Failed to load members directory.");
    res.redirect("/admin/dashboard");
  }
});

// POST /admin/user/delete - Delete user account
router.post("/user/delete", ensureAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    // Prevent admins from deleting themselves via backend check
    if (userId.toString() === req.user._id.toString()) {
      req.flash("error_msg", "You cannot delete your own admin account.");
      return res.redirect("/admin/members");
    }

    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      req.flash("error_msg", "User not found.");
      return res.redirect("/admin/members");
    }

    await User.findByIdAndDelete(userId);

    req.flash(
      "success_msg",
      `User ${userToDelete.email} has been permanently deleted.`,
    );
    res.redirect("/admin/members");
  } catch (err) {
    console.error("Delete User Error:", err);
    req.flash("error_msg", "Failed to delete user account.");
    res.redirect("/admin/members");
  }
});

router.post("/winners/add", ensureAdmin, async (req, res) => {
  try {
    const { winnerName, gameName, datePicker } = req.body;

    // Validate presence of all required fields
    if (!winnerName || !gameName || !datePicker) {
      req.flash("error_msg", "Please fill in all mandatory fields.");
      return res.redirect("/winners"); // Redirect to winners page to show error
    }

    // Create the new winner object
    const newWinner = new Winner({
      winnerName,
      gameName,
      // Mongoose automatically converts 'YYYY-MM-DD' string to a JS Date Object
      date: datePicker,
    });

    // Save to MongoDB
    await newWinner.save();

    req.flash(
      "success_msg",
      `Champion ${winnerName} for ${gameName} registered in Hall of Fame!`,
    );

    // Redirect to the winners page to see the new record
    res.redirect("/winners");
  } catch (err) {
    console.error("Error saving winner:", err);
    req.flash("error_msg", "Failed to save the champion record.");
    res.redirect("/winners");
  }
});

// POST /admin/settings/update
router.post("/settings/update", ensureAdmin, async (req, res) => {
  try {
    const {
      totalPrizeSponsored,
      discordServerLink,
      metricLabels,
      metricValues,
    } = req.body;

    let settings = await getSiteSettings();
    settings.totalPrizeSponsored = Number(totalPrizeSponsored) || 0;
    settings.discordServerLink = (discordServerLink || "").trim();

    // Process dynamic array of custom metrics
    const updatedCustomMetrics = [];
    if (metricLabels && metricValues) {
      const labels = Array.isArray(metricLabels)
        ? metricLabels
        : [metricLabels];
      const values = Array.isArray(metricValues)
        ? metricValues
        : [metricValues];

      for (let i = 0; i < labels.length; i++) {
        if (labels[i].trim() && values[i].trim()) {
          updatedCustomMetrics.push({
            label: labels[i].trim(),
            value: values[i].trim(),
          });
        }
      }
    }

    settings.customMetrics = updatedCustomMetrics;
    await settings.save();

    req.flash("success_msg", "Site metrics updated successfully!");
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error updating site settings:", err);
    req.flash("error_msg", "Failed to save metrics.");
    res.redirect("/admin/dashboard");
  }
});

module.exports = router;
