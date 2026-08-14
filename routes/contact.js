const express = require("express");
const router = express.Router();

// Middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  req.flash("error_msg", "You must be logged in to submit a report.");
  res.redirect("/login");
}

router.post("/contact", isLoggedIn, async (req, res) => {
  try {
    const { category, subject, message } = req.body;

    if (!subject || !message) {
      req.flash("error_msg", "Please fill in all required fields.");
      return res.redirect("/contact");
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (webhookUrl) {
      // 1. Theme Colors & Badges
      let embedColor = 0x00f3ff; // Cyan
      let badgeTag = "FEEDBACK";

      if (category.includes("Report")) {
        embedColor = 0xff0055; // Danger Red
        badgeTag = "REPORT";
      } else if (
        category.includes("Feedback") ||
        category.includes("Suggestion")
      ) {
        embedColor = 0xffd700; // Gold
        badgeTag = "SUGGESTION";
      } else if (category.includes("Bug")) {
        embedColor = 0xffa500; // Orange
        badgeTag = "BUG ";
      }

      // 2. Formatted Cyber Message Body
      const formattedDescription = [
        `**SUBJECT: ${subject}**`,
        ``,
        ``,
        `**Message Details**`,
        `- ${message}`,
        ``,
      ].join("\n");

      // 3. Discord Payload
      const discordPayload = {
        username: `ATX Anonymous Terminal`,
        avatar_url: "https://atx-family.onrender.com/images/atx.webp",
        embeds: [
          {
            title: `Anonymous ${badgeTag}`,
            description: formattedDescription,
            color: embedColor,
            footer: {
              text: "ATX Anonymous Portal",
              icon_url: "https://atx-family.onrender.com/images/atx.webp",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // 4. Dispatch to Discord
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    req.flash(
      "success_msg",
      "Your message has been dispatched anonymously to ATX Admins!",
    );
    res.redirect("/contact");
  } catch (err) {
    console.error("[ANONYMOUS REPORT ERROR]", err);
    req.flash(
      "error_msg",
      "Failed to dispatch anonymous message. Try again later.",
    );
    res.redirect("/contact");
  }
});

module.exports = router;
