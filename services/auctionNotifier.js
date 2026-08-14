// services/auctionNotifier.js

const sendAuctionAnnouncement = async ({
  type,
  auction,
  winnerName,
  winningBid,
}) => {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_AUCTION_ANNOUNCEMENTS_CHANNEL_ID;

  if (!botToken || !channelId) {
    console.warn(
      "[AUCTION BOT] Missing DISCORD_BOT_TOKEN or DISCORD_AUCTION_ANNOUNCEMENTS_CHANNEL_ID",
    );
    return;
  }

  try {
    let embedColor = 0x00f3ff; // Cyan for Launch
    let embedTitle = "<:atx:1369956242159833122> WEEKLY AUCTION STARTED!";
    let formattedDescription = "";

    if (type === "START") {
      embedColor = 0x00f3ff;
      embedTitle = "🔨 WEEKLY AUCTION STARTED! ";
      formattedDescription = [
        `# ${auction.itemName}`,
        `### **Starting Bid:** ${auction.startingBid.toLocaleString()} EP`,
        `### **Duration:** 50 Hours ⏳`,
        ``,
        `**Note:** ${auction.description || "No description provided."}`,
        ``,
        `-# 🔗 [**Bid here**](https://atx-family.onrender.com/auction)!`,
      ].join("\n");
    } else if (type === "END") {
      embedColor = 0xffd700; // Gold for Winner
      embedTitle = "✓ AUCTION COMPLETED!";
      formattedDescription = [
        `# ${auction.itemName}`,
        `### **Winner:** ${winnerName ? `${winnerName} ✨` : "*No Bids Placed*"}`,
        `### **Winning Bid:** ${winnerName ? `${(winningBid || 0).toLocaleString()} EP` : "N/A"}`,
        ``,
        `# 🎉 Congratulations Winner!`,
        `-# EP balance has updated!`,
        ``,
        `[**Explore More on Website**](https://atx-family.onrender.com/auction)`,
      ].join("\n");
    }

    const payload = {
      content: "@everyone",
      embeds: [
        {
          title: embedTitle,
          description: formattedDescription,
          color: embedColor,
          // timestamp: new Date().toISOString(),
        },
      ],
    };

    // Post message directly as your bot
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[DISCORD BOT POST ERROR] Status ${response.status}:`, err);
    }
  } catch (err) {
    console.error("[AUCTION ANNOUNCEMENT ERROR]", err);
  }
};

module.exports = { sendAuctionAnnouncement };
