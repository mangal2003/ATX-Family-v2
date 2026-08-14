// routes/music.js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("music", {
    title: "ATX Audio Lounge | Music Room",
    user: req.user,
  });
});

module.exports = router;
