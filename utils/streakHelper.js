const User = require("../models/User");

async function checkAndUpdateStreak(user) {
  try {
    if (!user || !user._id) return;

    const now = new Date();
    const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;

    if (!lastLogin) {
      // First recorded visit
      await User.findByIdAndUpdate(user._id, {
        $set: { streak: 1, lastLoginDate: now },
      });
      return;
    }

    // Convert dates to YYYY-MM-DD UTC strings to accurately compare calendar days
    const currentDateStr = now.toISOString().split("T")[0];
    const lastLoginDateStr = lastLogin.toISOString().split("T")[0];

    // Calculate calendar day difference
    const diffTime = new Date(currentDateStr) - new Date(lastLoginDateStr);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day visit: Increment streak & update lastLoginDate
      await User.findByIdAndUpdate(user._id, {
        $inc: { streak: 1 },
        $set: { lastLoginDate: now },
      });
    } else if (diffDays > 1) {
      // Missed one or more full days: Reset streak to 1 & update lastLoginDate
      await User.findByIdAndUpdate(user._id, {
        $set: { streak: 1, lastLoginDate: now },
      });
    }
    // If diffDays === 0, user already visited today -> No update needed
  } catch (err) {
    console.error("Streak Helper Error:", err);
  }
}

module.exports = { checkAndUpdateStreak };
