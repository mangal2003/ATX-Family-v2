const express = require("express");
const router = express.Router();
const Feature = require("../models/Feature");
// Ensure this path matches your existing Cloudinary/Multer storage configuration
const upload = require("../config/multer");

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  req.flash("error_msg", "Unauthorized access.");
  res.redirect("/features");
}

// GET /features
router.get("/", async (req, res) => {
  try {
    const features = await Feature.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.render("features", {
      title: "Platform Features | ATX Family",
      features,
      currentUser: req.user,
    });
  } catch (err) {
    console.error("Error fetching features:", err);
    res.redirect("/");
  }
});

// POST /features/add (Supports direct device image file upload)
router.post(
  "/add",
  ensureAdmin,
  upload.single("bgImageFile"),
  async (req, res) => {
    try {
      const { icon, heading, about, order } = req.body;

      // Use uploaded file path/url if present, fallback to default image
      const bgImageUrl = req.file
        ? req.file.path || req.file.secure_url
        : "/images/default-feature-bg.jpg";

      await Feature.create({
        icon: icon.trim() || "fa-solid fa-cube",
        heading: heading.trim(),
        about: about.trim(),
        bgImage: bgImageUrl,
        order: parseInt(order, 10) || 0,
      });

      req.flash("success_msg", "Feature published with custom backplate!");
      res.redirect("/features");
    } catch (err) {
      console.error("Error adding feature:", err);
      req.flash("error_msg", "Failed to add feature.");
      res.redirect("/features");
    }
  },
);

// POST /features/update (Supports replacing the image file)
router.post(
  "/update",
  ensureAdmin,
  upload.single("bgImageFile"),
  async (req, res) => {
    try {
      const { featureId, icon, heading, about, order, existingBgImage } =
        req.body;

      // Use newly uploaded file if provided, otherwise preserve existing URL
      const bgImageUrl = req.file
        ? req.file.path || req.file.secure_url
        : existingBgImage;

      await Feature.findByIdAndUpdate(featureId, {
        icon: icon.trim(),
        heading: heading.trim(),
        about: about.trim(),
        bgImage: bgImageUrl,
        order: parseInt(order, 10) || 0,
      });

      req.flash("success_msg", "Feature profile updated.");
      res.redirect("/features");
    } catch (err) {
      console.error("Error updating feature:", err);
      req.flash("error_msg", "Failed to update feature.");
      res.redirect("/features");
    }
  },
);

// POST /features/delete
router.post("/delete", ensureAdmin, async (req, res) => {
  try {
    const { featureId } = req.body;
    await Feature.findByIdAndDelete(featureId);
    req.flash("success_msg", "Feature removed.");
    res.redirect("/features");
  } catch (err) {
    console.error("Error deleting feature:", err);
    req.flash("error_msg", "Failed to delete feature.");
    res.redirect("/features");
  }
});

module.exports = router;
