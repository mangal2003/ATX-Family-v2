// config/cron.js
const cron = require("node-cron");
const User = require("../models/User");
const Auction = require("../models/Auction");

function initCronJobs() {
  // 1. Reset Monthly User XP (1st of every month at 00:00 GMT)
  cron.schedule(
    "0 0 1 * *",
    async () => {
      try {
        console.log(
          "[CRON] Running Monthly XP Reset (00:00 GMT 1st of month)...",
        );
        await User.updateMany({}, { $set: { xpBalance: 0 } });
        console.log("[CRON] All User XPs reset to 0.");
      } catch (err) {
        console.error("[CRON ERROR - Monthly XP Reset]", err);
      }
    },
    { timezone: "Etc/GMT" },
  );
}

module.exports = initCronJobs;
