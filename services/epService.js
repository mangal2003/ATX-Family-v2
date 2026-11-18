// services/epService.js
const User = require("../models/User");
const DiscordUser = require("../models/DiscordUser");

/**
 * Credits EP to a user.
 * - Always increments User.xpBalance.
 * - If user has a linked discordId, increments DiscordUser.botBalance too.
 */
async function awardEp(userId, amount) {
  if (!amount || isNaN(amount)) return null;

  // 1. Update website user
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { xpBalance: amount } },
    { returnDocument: "after" },
  );

  // 2. If connected to Discord, also increment DiscordUser.botBalance
  if (updatedUser && updatedUser.discordId) {
    await DiscordUser.findOneAndUpdate(
      { discordId: updatedUser.discordId },
      { $inc: { botBalance: amount } },
    );
  }

  return updatedUser;
}

/**
 * Deducts EP from a user (for Vault, Auction, etc.)
 */
async function deductEp(userId, amount) {
  if (!amount || isNaN(amount) || amount <= 0) return false;

  const user = await User.findById(userId);
  if (!user || (user.xpBalance || 0) < amount) return false;

  user.xpBalance -= amount;
  await user.save();

  if (user.discordId) {
    await DiscordUser.findOneAndUpdate(
      { discordId: user.discordId },
      { $inc: { botBalance: -amount } },
    );
  }

  return true;
}

module.exports = { awardEp, deductEp };
