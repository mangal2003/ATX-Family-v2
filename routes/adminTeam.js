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

    if (!targetUserId) {
      req.flash("error_msg", "Target user ID is missing.");
      return res.redirect("/admin-team");
    }

    // 1. Validate Plato ID (Max 12 chars, only letters, numbers, and underscores)
    let cleanPlatoId = platoId ? platoId.trim() : "";
    if (cleanPlatoId) {
      const platoRegex = /^[a-zA-Z0-9_]{1,12}$/;
      if (!platoRegex.test(cleanPlatoId)) {
        req.flash(
          "error_msg",
          "Plato ID must be 1 to 12 characters and contain only letters, numbers, and underscores (no spaces or special characters).",
        );
        return res.redirect("/admin-team");
      }
    }

    // 2. Execute Update
    await User.findByIdAndUpdate(targetUserId, {
      $set: {
        adminshipRole: adminshipRole || "Admin",
        discordId: discordId ? discordId.trim() : "",
        platoId: cleanPlatoId,
        bio: bio ? bio.trim() : "",
      },
    });

    req.flash("success_msg", "Admin profile updated successfully.");
    res.redirect("/admin-team");
  } catch (err) {
    console.error("[ADMIN TEAM UPDATE ERROR]:", err);
    req.flash("error_msg", "Failed to update admin profile.");
    res.redirect("/admin-team");
  }
});

module.exports = router;
