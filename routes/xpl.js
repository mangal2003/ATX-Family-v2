const express = require("express");
const router = express.Router();
const XplSeason = require("../models/XplSeason");
const XplRegistration = require("../models/XplRegistration");
const XplTeam = require("../models/XplTeam");
const { ensureAdmin } = require("../middleware/auth");
const User = require("../models/User");
const { upload } = require("../config/cloudinary");

// Helper function to convert integers to Roman Numerals
function toRoman(num) {
  const lookup = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1,
  };
  let roman = "";
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

// GET /xpl - Main Landing Page (Update to populate bidders & coordinators)
router.get("/", async (req, res) => {
  try {
    let currentSeason = await XplSeason.findOne({ status: { $ne: "ended" } })
      .populate("championTeam")
      .populate(
        "auctionState.auctionCoordinators",
        "username displayName platoId",
      )
      .sort({ seasonNumber: -1 });

    if (!currentSeason) {
      currentSeason = await XplSeason.findOne({ status: "ended" })
        .populate("championTeam")
        .populate(
          "auctionState.auctionCoordinators",
          "username displayName platoId",
        )
        .sort({ seasonNumber: -1 });
    }

    if (!currentSeason) {
      currentSeason = await XplSeason.create({
        seasonNumber: 1,
        seasonRoman: "I",
        status: "registration",
        isRegistrationOpen: true,
      });
    }

    const seasonNum = currentSeason.seasonNumber;
    let teams = [];
    if (currentSeason.status !== "ended") {
      teams = await XplTeam.find({ seasonNumber: seasonNum }).populate(
        "authorizedBidders",
        "username displayName platoId",
      );
    }

    const registrations = await XplRegistration.find({
      seasonNumber: seasonNum,
    });

    // Fetch all system users so admin can assign them as bidders or coordinators
    let allUsers = [];
    if (req.user && req.user.role === "admin") {
      allUsers = await User.find({}, "username displayName platoId role").sort({
        username: 1,
      });
    }

    let userRegistration = null;
    if (req.user && currentSeason) {
      userRegistration = await XplRegistration.findOne({
        seasonNumber: currentSeason.seasonNumber,
        $or: [
          { user: req.user._id },
          ...(req.user.email
            ? [{ userEmail: req.user.email.toLowerCase() }]
            : []),
        ],
      });
    }

    res.render("xpl/index", {
      title: "Xtreme Premier League | ATX",
      season: currentSeason,
      teams,
      registrations,
      registrationsCount: registrations.length,
      userRegistration,
      user: req.user,
      allUsers,
      toRoman,
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

// POST /xpl/register - Member Self-Registration
// POST /xpl/register - Member Self-Registration
router.post("/register", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash("error_msg", "Please login to register for XPL.");
    return res.redirect("/xpl");
  }

  try {
    const {
      seasonNumber,
      platoId,
      playerName,
      preferredGames,
      aboutPlayer,
      basePrice,
    } = req.body;

    const seasonNum = Number(seasonNumber);
    const userEmail = req.user.email
      ? req.user.email.toLowerCase().trim()
      : null;

    // 1. Check if the season exists and registration is open
    const season = await XplSeason.findOne({ seasonNumber: seasonNum });
    if (!season || !season.isRegistrationOpen) {
      req.flash("error_msg", "Registration for this season is closed.");
      return res.redirect("/xpl");
    }

    // 2. Strict Check: Has this account/email already registered for this season?
    const existingRegistration = await XplRegistration.findOne({
      seasonNumber: seasonNum,
      $or: [
        { user: req.user._id },
        ...(userEmail ? [{ userEmail }] : []),
        { platoId: platoId.trim().toLowerCase() },
      ],
    });

    if (existingRegistration) {
      req.flash(
        "error_msg",
        "You are already registered for Season " + seasonNum + "!",
      );
      return res.redirect("/xpl");
    }

    // 3. Create the registration entry bound to req.user & req.user.email
    await XplRegistration.create({
      seasonNumber: seasonNum,
      user: req.user._id,
      userEmail: userEmail,
      platoId: platoId.trim().toLowerCase(),
      playerName: playerName.trim(),
      preferredGames: preferredGames ? preferredGames.trim() : "",
      aboutPlayer: aboutPlayer ? aboutPlayer.trim() : "",
      basePrice: Number(basePrice) || 100,
      registeredByAdmin: false,
    });

    req.flash("success_msg", "Your XPL registration has been submitted!");
    res.redirect("/xpl");
  } catch (err) {
    console.error("XPL Register Error:", err);
    if (err.code === 11000) {
      req.flash("error_msg", "You are already registered for this season.");
    } else {
      req.flash("error_msg", "Error completing registration.");
    }
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/toggle-registration - Toggle Registration Open/Closed
router.post("/admin/toggle-registration", ensureAdmin, async (req, res) => {
  try {
    const { seasonId, isRegistrationOpen } = req.body;

    if (!seasonId) {
      req.flash("error_msg", "No active season ID provided.");
      return res.redirect("/xpl");
    }

    const isOpen = isRegistrationOpen === "true";
    await XplSeason.findByIdAndUpdate(seasonId, {
      isRegistrationOpen: isOpen,
      status: isOpen ? "registration" : "draft",
    });

    req.flash(
      "success_msg",
      `Registration window ${isOpen ? "opened" : "closed"} successfully!`,
    );
    res.redirect("/xpl");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to update registration status.");
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/end-current-season - Explicitly End Active Season
router.post("/admin/end-current-season", ensureAdmin, async (req, res) => {
  try {
    const { seasonId } = req.body;

    if (!seasonId) {
      req.flash("error_msg", "No active season found to end.");
      return res.redirect("/xpl");
    }

    const season = await XplSeason.findByIdAndUpdate(
      seasonId,
      {
        status: "ended",
        isRegistrationOpen: false,
      },
      { new: true },
    );

    req.flash(
      "success_msg",
      `Season ${season ? season.seasonRoman : ""} has been concluded.`,
    );
    res.redirect("/xpl");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to end season.");
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/start-next-season - Start New Season (e.g., May or Nov)
router.post("/admin/start-next-season", ensureAdmin, async (req, res) => {
  try {
    // Ensure any existing active season is marked as ended
    await XplSeason.updateMany(
      { status: { $ne: "ended" } },
      { status: "ended", isRegistrationOpen: false },
    );

    // Calculate next season number
    const lastSeason = await XplSeason.findOne().sort({ seasonNumber: -1 });
    const nextSeasonNum = lastSeason ? lastSeason.seasonNumber + 1 : 1;

    const newSeason = await XplSeason.create({
      seasonNumber: nextSeasonNum,
      seasonRoman: toRoman(nextSeasonNum),
      status: "registration",
      isRegistrationOpen: true,
    });

    req.flash(
      "success_msg",
      `Launched Season ${newSeason.seasonRoman}! Registration is now open.`,
    );
    res.redirect("/xpl");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to start next season.");
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/register-player - Admin Force Registration
router.post("/admin/register-player", ensureAdmin, async (req, res) => {
  try {
    const {
      seasonNumber,
      platoId,
      playerName,
      preferredGames,
      aboutPlayer,
      basePrice,
    } = req.body;

    await XplRegistration.create({
      seasonNumber: Number(seasonNumber),
      platoId: platoId.trim().toLowerCase(), // Normalized lowercase ID
      playerName: playerName.trim(),
      preferredGames: preferredGames ? preferredGames.trim() : "",
      aboutPlayer: aboutPlayer ? aboutPlayer.trim() : "",
      basePrice: Number(basePrice) || 100,
      registeredByAdmin: false,
    });

    req.flash(
      "success_msg",
      `Registered ${playerName} (${platoId}) for Season ${seasonNumber}.`,
    );
    res.redirect("/xpl");
  } catch (err) {
    if (err.code === 11000) {
      req.flash("error_msg", "This Plato ID is already registered.");
    } else {
      req.flash("error_msg", "Failed to register player.");
    }
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/create-team - Create a new XPL Team for the active season
router.post(
  "/admin/create-team",
  ensureAdmin,
  upload.single("logo"),
  async (req, res) => {
    try {
      const {
        seasonNumber,
        teamName,
        teamTag,
        ownerPlatoId,
        ownerName,
        totalBudget,
      } = req.body;

      const logoUrl = req.file ? req.file.path : "/images/default-team.png";

      if (!teamName || !teamTag || !ownerPlatoId || !ownerName) {
        req.flash("error_msg", "Please fill in all required team details.");
        return res.redirect("/xpl");
      }

      const budget = Number(totalBudget) || 10000;

      await XplTeam.create({
        seasonNumber: Number(seasonNumber),
        teamName: teamName.trim(),
        teamTag: teamTag.trim().toUpperCase(),
        logoUrl,
        ownerPlatoId: ownerPlatoId.trim().toLowerCase(),
        ownerName: ownerName.trim(),
        totalBudget: budget,
        remainingBudget: budget,
      });

      req.flash("success_msg", `Team '${teamName}' created successfully!`);
      res.redirect("/xpl");
    } catch (err) {
      console.error(err);
      req.flash("error_msg", "Failed to create team.");
      res.redirect("/xpl");
    }
  },
);

// POST /xpl/admin/delete-team - Remove a Team from active season
router.post("/admin/delete-team", ensureAdmin, async (req, res) => {
  try {
    const { teamId } = req.body;
    await XplTeam.findByIdAndDelete(teamId);

    req.flash("success_msg", "Team deleted successfully.");
    res.redirect("/xpl");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to delete team.");
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/assign-bidders - Assign/Update Team Bidders
router.post("/admin/assign-bidders", ensureAdmin, async (req, res) => {
  try {
    const { teamId, bidderUserIds } = req.body;
    // bidderUserIds can be an array or a single string from multi-select form
    const biddersArray = Array.isArray(bidderUserIds)
      ? bidderUserIds
      : bidderUserIds
        ? [bidderUserIds]
        : [];

    await XplTeam.findByIdAndUpdate(teamId, {
      authorizedBidders: biddersArray,
    });

    req.flash("success_msg", "Updated team authorized bidders.");
    res.redirect("/xpl");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to assign bidders.");
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/assign-coordinators - Assign Auction Coordinators for Season
// POST /xpl/admin/assign-coordinators
router.post("/admin/assign-coordinators", ensureAdmin, async (req, res) => {
  try {
    const { seasonId, coordinatorUserIds } = req.body;
    const coordinatorsArray = Array.isArray(coordinatorUserIds)
      ? coordinatorUserIds
      : coordinatorUserIds
        ? [coordinatorUserIds]
        : [];

    await XplSeason.findByIdAndUpdate(seasonId, {
      "auctionState.auctionCoordinators": coordinatorsArray,
    });

    req.flash("success_msg", "Auction coordinators updated successfully.");
    res.redirect("/xpl");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to assign auction coordinators.");
    res.redirect("/xpl");
  }
});

// GET /xpl/auction - Live XPL EP Auction Room
router.get("/auction", async (req, res) => {
  try {
    // 1. Fetch only active/ongoing seasons (Exclude ended seasons)
    const currentSeason = await XplSeason.findOne({ status: { $ne: "ended" } })
      .populate({
        path: "auctionState.highestBidderTeam",
        strictPopulate: false,
      })
      .populate({
        path: "auctionState.auctionCoordinators",
        select: "username displayName platoId",
        strictPopulate: false,
      })
      .populate({ path: "championTeam", strictPopulate: false });

    // 2. 404 HANDLING: If no active season exists or all seasons are ended, return 404
    if (!currentSeason) {
      res.status(404);
      return res.render("404", {
        title: "404 - XPL Auction Not Found",
        message:
          "There is currently no active XPL season or live auction session available.",
      });
    }

    const seasonNum = currentSeason.seasonNumber;

    // 3. Fetch teams for this active season
    const teams = await XplTeam.find({ seasonNumber: seasonNum }).populate(
      "authorizedBidders",
    );

    // 4. Fetch current nominated player details if a player is active
    let currentNominatedPlayer = null;
    if (
      currentSeason.auctionState &&
      currentSeason.auctionState.currentNominatedPlatoId
    ) {
      currentNominatedPlayer = await XplRegistration.findOne({
        seasonNumber: seasonNum,
        platoId: currentSeason.auctionState.currentNominatedPlatoId,
      });
    }

    // 5. Fetch pending players list for nomination dropdown
    const pendingPlayers = await XplRegistration.find({
      seasonNumber: seasonNum,
      status: "pending",
    }).sort({ playerName: 1 });

    // 6. Check if user is explicitly an assigned Auction Coordinator
    let isCoordinator = false;
    if (
      req.user &&
      currentSeason.auctionState &&
      Array.isArray(currentSeason.auctionState.auctionCoordinators)
    ) {
      isCoordinator = currentSeason.auctionState.auctionCoordinators.some(
        (c) =>
          (c._id ? c._id.toString() : c.toString()) === req.user._id.toString(),
      );
    }

    // 7. Check if user is an authorized bidder for a team
    let userTeam = null;
    if (req.user) {
      userTeam = teams.find(
        (t) =>
          t.authorizedBidders &&
          t.authorizedBidders.some(
            (b) => b._id.toString() === req.user._id.toString(),
          ),
      );
    }

    res.render("xpl/auction", {
      title: `XPL Season ${currentSeason.seasonRoman} | Live Auction`,
      season: currentSeason,
      currentNominatedPlayer,
      teams,
      pendingPlayers,
      isCoordinator,
      userTeam,
      user: req.user,
    });
  } catch (err) {
    console.error("Auction Room Route Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET /xpl/season-:seasonNumber - View specific season details
router.get("/season-:seasonNumber", async (req, res) => {
  try {
    const seasonNumber = parseInt(req.params.seasonNumber);
    if (isNaN(seasonNumber)) return res.redirect("/xpl");

    const targetSeason = await XplSeason.findOne({ seasonNumber })
      .populate("championTeam")
      .populate("auctionState.auctionCoordinators");

    if (!targetSeason) {
      req.flash("error_msg", `Season ${seasonNumber} not found.`);
      return res.redirect("/xpl");
    }

    const teams = await XplTeam.find({ seasonNumber });
    const registrations = await XplRegistration.find({ seasonNumber });

    res.render("xpl/season-detail", {
      title: `XPL Season ${targetSeason.seasonRoman} | ATX`,
      season: targetSeason,
      teams,
      registrations,
      user: req.user,
      toRoman, // Helper function to convert integer to Roman numerals
    });
  } catch (err) {
    console.error("Season Detail Error:", err);
    res.redirect("/xpl");
  }
});

// POST /xpl/admin/delete-registration - Cancel a player's registration
router.post("/admin/delete-registration", ensureAdmin, async (req, res) => {
  try {
    const { registrationId, seasonNumber } = req.body;
    await XplRegistration.findByIdAndDelete(registrationId);

    req.flash("success_msg", "Player registration canceled successfully.");
    res.redirect(`/xpl/season-${seasonNumber}`);
  } catch (err) {
    console.error("Delete Registration Error:", err);
    req.flash("error_msg", "Failed to cancel registration.");
    res.redirect("back");
  }
});

module.exports = router;
