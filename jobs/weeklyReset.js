const cron = require("node-cron");
const User = require("../models/User");

/**
 * Weekly Reset Cron Job
 * Runs every Wednesday at exactly 15:00 (3:00 PM) IST
 * Cron pattern: "0 15 * * 3" (Minute 0, Hour 15, Day 3 = Wednesday)
 */
function initWeeklyResetJob() {
  cron.schedule(
    "0 15 * * 3",
    async () => {
      try {
        console.log(
          "[CRON] Running Weekly Quiz Reset (Wednesday 3:00 PM IST)...",
        );

        const result = await User.updateMany(
          {},
          {
            $set: {
              weeklyScore: 0,
              quizzesCompleted: 0,
              lastQuizSlot: "", // Clears attempt slot
            },
          },
        );

        console.log(
          `[CRON] Successfully reset weeklyScore, quizzesCompleted & lastQuizSlot for ${result.modifiedCount} users.`,
        );
      } catch (err) {
        console.error("[CRON ERROR] Failed to reset weekly leaderboard:", err);
      }
    },
    {
      timezone: "Asia/Kolkata", // Guarantees execution at 3:00 PM IST
    },
  );
}

module.exports = initWeeklyResetJob;
