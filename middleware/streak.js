const { checkAndUpdateStreak } = require("../utils/streakHelper");

module.exports = async function updateStreakOnVisit(req, res, next) {
  // Check if the Passport has authenticated the request
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Run asynchronously without blocking response rendering
    checkAndUpdateStreak(req.user).catch((err) =>
      console.error("Streak Middleware Error:", err),
    );
  }
  next();
};
