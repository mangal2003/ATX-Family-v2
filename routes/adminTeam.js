const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Middleware check for admin permissions
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  req.flash("error_msg", "Unauthorized access.");
  res.redirect("/");
}

// GET /admin-team - Publicly viewable, editable by admins
router.get("/admin-team", async (req, res) => {
  try {
    // Fetch all users marked as admin
    const admins = await User.find({ role: "admin" }).lean();

    // Sort priority: Owner -> Admin -> Moderator
    const roleHierarchy = { Owner: 1, Admin: 2, Moderator: 3 };
    admins.sort((a, b) => {
      const rankA = roleHierarchy[a.adminshipRole] || 4;
      const rankB = roleHierarchy[b.adminshipRole] || 4;
      return rankA - rankB;
    });

    res.render("admin-team", {
      title: "ATX Team",
      admins,
      currentUser: req.user,
    });
  } catch (err) {
    console.error("Error fetching admin team:", err);
    res.redirect("/");
  }
});

// POST /admin-team/update-profile - Admin inline card updates
router.post("/admin-team/update-profile", ensureAdmin, async (req, res) => {
  try {
    const { targetUserId, adminshipRole, discordId, platoId, bio } = req.body;

    await User.findByIdAndUpdate(targetUserId, {
      adminshipRole,
      discordId: discordId.trim(),
      platoId: platoId.trim(),
      bio: bio.trim(),
    });

    req.flash("success_msg", "Admin profile updated successfully.");
    res.redirect("/admin-team");
  } catch (err) {
    console.error("Failed to update admin profile:", err);
    req.flash("error_msg", "Failed to update admin profile.");
    res.redirect("/admin-team");
  }
});

module.exports = router;
