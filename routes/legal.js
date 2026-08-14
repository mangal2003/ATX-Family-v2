const express = require("express");
const router = express.Router();

router.get("/about", (req, res) =>
  res.render("about", { title: "About Us | ATX Family" }),
);
router.get("/privacy", (req, res) =>
  res.render("privacy", { title: "Privacy Policy | ATX Family" }),
);
router.get("/terms", (req, res) =>
  res.render("terms", { title: "Terms of Service | ATX Family" }),
);
router.get("/contact", (req, res) =>
  res.render("contact", { title: "Contact Us | ATX Family" }),
);

module.exports = router;
