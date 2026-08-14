const express = require("express");
const passport = require("passport");
const router = express.Router();

// Render Login Page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/");
  res.render("login", { title: "Login | ATX Family" });
});

// Render Register Page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/");
  res.render("register", { title: "Register | ATX Family" });
});

// Initiate Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// Google OAuth Callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    req.flash("success_msg", `Welcome back, ${req.user.username}!`);
    res.redirect("/");
  },
);

// Logout Handler
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success_msg", "You have been logged out.");
    res.redirect("/");
  });
});

module.exports = router;
