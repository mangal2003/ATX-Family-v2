const express = require("express");
const router = express.Router();
// Import your Winner Mongoose model or Database helper
const Winner = require("../models/Winner");

// GET /winners - Hall of Fame with Pagination
// GET /winners - Render Hall of Fame with ALL records
router.get("/", async (req, res) => {
  try {
    // Fetch all records sorted by most recent date
    const winners = await Winner.find().sort({ date: -1 });

    res.render("winners", {
      title: "ATX Hall of Fame",
      winners,
    });
  } catch (err) {
    console.error("Error fetching winners:", err);
    req.flash("error_msg", "Could not retrieve Hall of Fame records.");
    res.redirect("/");
  }
});

module.exports = router;
