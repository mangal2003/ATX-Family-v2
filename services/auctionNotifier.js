// services/auctionNotifier.js

const sendAuctionAnnouncement = async ({
  type,
  auction,
  winnerName,
  winningBid,
}) => {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_AUCTION_ANNOUNCEMENTS_CHANNEL_ID;
  const targetDate = new Date(Date.now() + 50 * 60 * 60 * 1000);
  const unixTimestamp = Math.floor(targetDate.getTime() / 1000);
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
      embedTitle = "# <:atx:1369956242159833122> WEEKLY AUCTION STARTED!";
      formattedDescription = [
        `### <:ATX_auction:1538433231412658176> **${auction.itemName}**`,
        `> `,
        `> Starting Bid: ${auction.startingBid.toLocaleString()} EP <:ATX_bid:1538490397876293753>`,
        `> Ends: <t:${unixTimestamp}:R> <:ATX_timer:1538491784802336797>`,
        `> `,
        ``,
        `**Note:** ${auction.description || "No description provided."}`,
        `-# [**Place Your Bids here!**](https://atx-family.onrender.com/auction)`,
      ].join("\n");
    } else if (type === "END") {
      embedColor = 0xffd700; // Gold for Winner
      embedTitle = "# <:ATX_auction:1538433231412658176> AUCTION COMPLETED!";
      formattedDescription = [
        `${winnerName ? `Congratulations ${winnerName ? `**${winnerName}** <:Devil_Love:1350202191385722940> Claim __${auction.itemName}__ from **OP_MANGAL**` : " None<:TomatoTsuna:1450192484981280860>"}` : "<:TomatoTsuna:1450192484981280860> Item went unsold"}`,
        ``,
        `> `,
        `> Winning Bid: ${winnerName ? `**${(winningBid || 0).toLocaleString()} EP**` : "No bid received!"}`,
        `> `,
        ``,
        `[**Explore more**](https://atx-family.onrender.com/)`,
        ``,
      ].join("\n");
    }

    const payload = {
      content: "@everyone",
      embeds: [
        {
          title: embedTitle,
          description: formattedDescription,
          color: embedColor,
          timestamp: new Date().toISOString(),
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
