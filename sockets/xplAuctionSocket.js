const XplSeason = require("../models/XplSeason");
const XplTeam = require("../models/XplTeam");
const XplRegistration = require("../models/XplRegistration");

// Memory store for active timers and flags per season room
const activeTimers = {};

// Taglines for base price announcements
const BASE_PRICE_TAGLINES = [
  "Steal of the century starting at",
  "Wallet check! Opening the floor at",
  "High skill, budget price tag of",
  "Bidding frenzy starts now at",
  "Ready to carry your team for just",
];

// Helper to clear existing timers for a season room
function clearAuctionTimers(seasonNumber) {
  if (activeTimers[seasonNumber]) {
    if (activeTimers[seasonNumber].warningTimer)
      clearTimeout(activeTimers[seasonNumber].warningTimer);
    if (activeTimers[seasonNumber].finalSeqTimer)
      clearTimeout(activeTimers[seasonNumber].finalSeqTimer);
    if (activeTimers[seasonNumber].resumeTimer)
      clearTimeout(activeTimers[seasonNumber].resumeTimer);

    // Preserve flag state while clearing timeouts
    const pauseFlag = activeTimers[seasonNumber].isPauseRequested || false;
    activeTimers[seasonNumber] = { isPauseRequested: pauseFlag };
  } else {
    activeTimers[seasonNumber] = { isPauseRequested: false };
  }
}

// Start/Reset the 15s warning and 30s Going sequence auction timers
function resetBidTimers(seasonNumber, io) {
  clearAuctionTimers(seasonNumber);

  activeTimers[seasonNumber].warningTimer = setTimeout(async () => {
    const warningMsgs = [
      "Going quiet... Any further bids for this player?",
      "15 seconds without a bid! Is this the final price?",
      "Clock ticking! Anyone willing to raise the bid?",
      "Wake up Bidders. Last chance to jump in!",
    ];
    const randomMsg =
      warningMsgs[Math.floor(Math.random() * warningMsgs.length)];

    await appendAndEmitSystemLog(seasonNumber, randomMsg, io, "system");
  }, 15000);

  activeTimers[seasonNumber].finalSeqTimer = setTimeout(() => {
    triggerGoingSequence(seasonNumber, io);
  }, 30000);
}

// 30-Second Final Sequence Engine (Gap of 7 Seconds)
function triggerGoingSequence(seasonNumber, io) {
  appendAndEmitSystemLog(seasonNumber, "⌛GOING ONCE...", io, "system");

  const twiceTimer = setTimeout(() => {
    appendAndEmitSystemLog(seasonNumber, "⚡GOING TWICE...", io, "system");

    const soldTimer = setTimeout(async () => {
      await finalizeRound(seasonNumber, io);
    }, 7000);

    if (activeTimers[seasonNumber])
      activeTimers[seasonNumber].finalSeqTimer = soldTimer;
  }, 7000);

  if (activeTimers[seasonNumber])
    activeTimers[seasonNumber].finalSeqTimer = twiceTimer;
}

// Append System Message to DB and Emit with dynamic logType ('sold', 'unsold', 'system')
async function appendAndEmitSystemLog(
  seasonNumber,
  message,
  io,
  type = "system",
) {
  try {
    const season = await XplSeason.findOne({ seasonNumber });
    if (!season) return;

    const logEntry = {
      isSystem: true,
      logType: type,
      message,
      timestamp: new Date(),
    };

    season.auctionState.bidHistory.unshift(logEntry);
    await season.save();

    io.to(`xpl-season-${seasonNumber}`).emit("system-log-emitted", logEntry);
  } catch (err) {
    console.error("System Log Error:", err);
  }
}

// Finalize Round (Sold / Unsold Logic)
async function finalizeRound(seasonNumber, io) {
  const isPauseRequested =
    activeTimers[seasonNumber]?.isPauseRequested || false;
  clearAuctionTimers(seasonNumber);

  try {
    const season = await XplSeason.findOne({ seasonNumber });
    if (!season || !season.auctionState.currentNominatedPlatoId) return;

    const player = await XplRegistration.findOne({
      seasonNumber,
      platoId: season.auctionState.currentNominatedPlatoId,
    });

    if (!player) return;

    if (season.auctionState.highestBidderTeam) {
      // SOLD
      const team = await XplTeam.findById(
        season.auctionState.highestBidderTeam,
      );
      team.remainingBudget -= season.auctionState.currentBid;
      team.roster.push({
        platoId: player.platoId,
        playerName: player.playerName,
        boughtPrice: season.auctionState.currentBid,
      });
      await team.save();

      player.status = "sold";
      player.soldToTeam = team._id;
      player.soldAmount = season.auctionState.currentBid;
      await player.save();

      // Structured Result Card Payload
      const soldCardLog = {
        isResultCard: true,
        logType: "sold",
        platoId: player.platoId,
        basePrice: player.basePrice || 100,
        teamTag: team.teamTag,
        teamName: team.teamName,
        soldAmount: season.auctionState.currentBid,
        timestamp: new Date(),
      };

      season.auctionState.bidHistory.unshift(soldCardLog);
      await season.save();

      io.to(`xpl-season-${seasonNumber}`).emit(
        "system-log-emitted",
        soldCardLog,
      );

      io.to(`xpl-season-${seasonNumber}`).emit("auction-round-ended", {
        status: "sold",
        player,
        team: {
          _id: team._id.toString(),
          teamTag: team.teamTag,
          teamName: team.teamName,
        },
        amount: season.auctionState.currentBid,
        newRemainingPurse: team.remainingBudget,
      });
    } else {
      // UNSOLD
      player.status = "unsold";
      await player.save();

      const unsoldCardLog = {
        isResultCard: true,
        logType: "unsold",
        platoId: player.platoId,
        basePrice: player.basePrice || 100,
        timestamp: new Date(),
      };

      season.auctionState.bidHistory.unshift(unsoldCardLog);
      await season.save();

      io.to(`xpl-season-${seasonNumber}`).emit(
        "system-log-emitted",
        unsoldCardLog,
      );

      io.to(`xpl-season-${seasonNumber}`).emit("auction-round-ended", {
        status: "unsold",
        player,
      });
    }

    // Reset Nomination State
    season.auctionState.currentNominatedPlatoId = null;
    season.auctionState.currentNominatedPlayerName = null;
    season.auctionState.currentBid = 0;
    season.auctionState.highestBidderTeam = null;

    if (isPauseRequested) {
      season.auctionState.status = "paused";
      await season.save();

      activeTimers[seasonNumber].isPauseRequested = false;
      await appendAndEmitSystemLog(
        seasonNumber,
        "PAUSED: Current round completed. Auction paused by coordinator request.",
        io,
        "system",
      );
      io.to(`xpl-season-${seasonNumber}`).emit("auction-status-changed", {
        status: "paused",
      });
      return;
    }

    season.auctionState.status = "idle";
    await season.save();

    // Auto-fetch next player after 5-second breather
    setTimeout(async () => {
      await autoNominateNext(seasonNumber, io);
    }, 5000);
  } catch (err) {
    console.error("Finalize Round Error:", err);
  }
}

// Auto Nominate Engine
async function autoNominateNext(seasonNumber, io) {
  try {
    const season = await XplSeason.findOne({ seasonNumber });
    if (!season || season.auctionState.status === "paused") return;

    // Fetch processed count to determine Lot number
    const processedCount = await XplRegistration.countDocuments({
      seasonNumber,
      status: { $in: ["sold", "unsold"] },
    });
    const lotNumber = processedCount + 1;

    const nextPlayer = await XplRegistration.findOne({
      seasonNumber,
      status: "pending",
    }).sort({ createdAt: 1 });

    if (!nextPlayer) {
      season.auctionState.status = "ended";
      season.status = "auction";
      await season.save();

      await appendAndEmitSystemLog(
        seasonNumber,
        "AUCTION COMPLETED: All players have been processed.",
        io,
        "system",
      );
      return io.to(`xpl-season-${seasonNumber}`).emit("auction-finished");
    }

    season.auctionState.status = "live";
    season.auctionState.currentNominatedPlatoId = nextPlayer.platoId;
    season.auctionState.currentNominatedPlayerName = nextPlayer.playerName;
    season.auctionState.currentBid = nextPlayer.basePrice || 100;
    season.auctionState.highestBidderTeam = null;

    await season.save();

    // Select random tagline
    const randomTagline =
      BASE_PRICE_TAGLINES[
        Math.floor(Math.random() * BASE_PRICE_TAGLINES.length)
      ];

    // Create nomination card payload
    const nominationLog = {
      isNominationCard: true,
      lotNumber,
      platoId: nextPlayer.platoId,
      preferredGames: nextPlayer.preferredGames || "None specified",
      aboutPlayer: nextPlayer.aboutPlayer || "No bio provided.",
      basePrice: season.auctionState.currentBid,
      tagline: randomTagline,
      timestamp: new Date(),
    };

    season.auctionState.bidHistory.unshift(nominationLog);
    await season.save();

    io.to(`xpl-season-${seasonNumber}`).emit(
      "system-nomination-card",
      nominationLog,
    );

    io.to(`xpl-season-${seasonNumber}`).emit("player-nominated", {
      player: nextPlayer,
      currentBid: season.auctionState.currentBid,
    });

    resetBidTimers(seasonNumber, io);
  } catch (err) {
    console.error("Auto Nominate Error:", err);
  }
}

module.exports = function (io) {
  io.on("connection", (socket) => {
    socket.on("join-auction-room", async ({ seasonNumber }) => {
      socket.join(`xpl-season-${seasonNumber}`);
      const season = await XplSeason.findOne({ seasonNumber }).populate(
        "auctionState.highestBidderTeam",
      );

      if (season) {
        let player = null;
        if (season.auctionState.currentNominatedPlatoId) {
          player = await XplRegistration.findOne({
            seasonNumber,
            platoId: season.auctionState.currentNominatedPlatoId,
          });
        }

        socket.emit("sync-auction-state", {
          status: season.auctionState.status || "idle",
          currentNominatedPlatoId: season.auctionState.currentNominatedPlatoId,
          nominatedPlayer: player,
          currentBid: season.auctionState.currentBid,
          highestBidderTeam: season.auctionState.highestBidderTeam,
          bidHistory: season.auctionState.bidHistory || [],
        });
      }
    });

    // Handle Live Bids
    socket.on("place-bid", async ({ seasonNumber, teamId, amount }) => {
      try {
        const season = await XplSeason.findOne({ seasonNumber });
        if (!season || season.auctionState.status !== "live") {
          return socket.emit("auction-error", {
            message: "Auction is not live.",
          });
        }
        if (amount % 50 !== 0) {
          return socket.emit("auction-error", {
            message: "Bid must end in 50 or 00.",
          });
        }

        const team = await XplTeam.findById(teamId);
        if (!team)
          return socket.emit("auction-error", { message: "Team not found." });
        if (amount <= season.auctionState.currentBid)
          return socket.emit("auction-error", {
            message: "Bid must be higher.",
          });
        if (amount > team.remainingBudget)
          return socket.emit("auction-error", {
            message: "Insufficient team purse!",
          });
        if (
          season.auctionState.highestBidderTeam &&
          season.auctionState.highestBidderTeam.toString() === teamId
        ) {
          return socket.emit("auction-error", {
            message: "Your team is already lead bidder.",
          });
        }
        const currentBidBefore = season.auctionState.currentBid;
        const incrementAmount = amount - currentBidBefore;
        season.auctionState.currentBid = amount;
        season.auctionState.highestBidderTeam = team._id;

        const bidEntry = {
          isSystem: false,
          teamName: team.teamName,
          teamTag: team.teamTag,
          logoUrl: team.logoUrl,
          amount: amount,
          increment: incrementAmount,
          timestamp: new Date(),
        };

        season.auctionState.bidHistory.unshift(bidEntry);
        await season.save();

        io.to(`xpl-season-${seasonNumber}`).emit("bid-updated", bidEntry);

        // Reset timer on valid bid
        resetBidTimers(seasonNumber, io);
      } catch (err) {
        console.error(err);
      }
    });

    // Coordinator Action: Start Session (60s countdown)
    socket.on("coordinator-start-auction", async ({ seasonNumber }) => {
      try {
        const season = await XplSeason.findOne({ seasonNumber });
        if (season) {
          season.auctionState.status = "countdown";
          await season.save();

          await appendAndEmitSystemLog(
            seasonNumber,
            "Auction starting in 60 seconds...",
            io,
            "system",
          );
          io.to(`xpl-season-${seasonNumber}`).emit(
            "auction-countdown-started",
            { seconds: 60 },
          );

          setTimeout(async () => {
            await autoNominateNext(seasonNumber, io);
          }, 60000);
        }
      } catch (err) {
        console.error(err);
      }
    });

    // Coordinator Action: Pause / Resume Control
    socket.on("coordinator-toggle-pause", async ({ seasonNumber }) => {
      try {
        const season = await XplSeason.findOne({ seasonNumber });
        if (!season) return;

        if (!activeTimers[seasonNumber]) {
          activeTimers[seasonNumber] = { isPauseRequested: false };
        }

        const isCurrentlyLive = season.auctionState.status === "live";
        const isCurrentlyNominated =
          !!season.auctionState.currentNominatedPlatoId;

        if (isCurrentlyLive && isCurrentlyNominated) {
          // RULE: Do not halt active player mid-bidding. Flag pause for post-sale.
          activeTimers[seasonNumber].isPauseRequested =
            !activeTimers[seasonNumber].isPauseRequested;

          const pauseStatusText = activeTimers[seasonNumber].isPauseRequested
            ? "PAUSE QUEUED: Auction will pause after the current player is sold/unsold."
            : "PAUSE CANCELLED: Auction will continue smoothly to next player.";

          await appendAndEmitSystemLog(
            seasonNumber,
            pauseStatusText,
            io,
            "system",
          );
        } else if (season.auctionState.status === "paused") {
          // RESUME ACTION: Start 45s countdown before fetching next nomination
          season.auctionState.status = "countdown";
          await season.save();

          await appendAndEmitSystemLog(
            seasonNumber,
            "RESUMED: Auction resumed. Next nomination in 45 seconds...",
            io,
            "system",
          );
          io.to(`xpl-season-${seasonNumber}`).emit(
            "auction-countdown-started",
            { seconds: 45 },
          );

          activeTimers[seasonNumber].resumeTimer = setTimeout(async () => {
            await autoNominateNext(seasonNumber, io);
          }, 45000);
        } else {
          // Pause when no active nomination exists
          season.auctionState.status = "paused";
          await season.save();
          await appendAndEmitSystemLog(
            seasonNumber,
            "PAUSED: Auction paused by coordinator.",
            io,
            "system",
          );
          io.to(`xpl-season-${seasonNumber}`).emit("auction-status-changed", {
            status: "paused",
          });
        }
      } catch (err) {
        console.error(err);
      }
    });
  });
};
