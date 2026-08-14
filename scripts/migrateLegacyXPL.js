// // scripts/migrateCrossDb.js
// require("dotenv").config();
// const { MongoClient, ObjectId } = require("mongodb");

// const ROMAN_MAP = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };

// async function runCrossDatabaseMigration() {
//   const uri = process.env.MONGO_URI;
//   if (!uri) {
//     console.error("[ERROR] MONGODB_URI missing from .env");
//     process.exit(1);
//   }

//   const client = new MongoClient(uri);

//   try {
//     await client.connect();
//     console.log("Connected to MongoDB Cluster.");

//     const sourceDb = client.db("ATX-Family");
//     const targetDb = client.db("ATX-Family-v2");

//     const legacyTeams = await sourceDb
//       .collection("franchises-xpl")
//       .find({})
//       .toArray();
//     const legacyPlayers = await sourceDb
//       .collection("players-xpl")
//       .find({})
//       .toArray();

//     console.log(`\n--- Source Inspection (ATX-Family) ---`);
//     console.log(`Legacy Teams Found: ${legacyTeams.length}`);
//     console.log(`Legacy Players Found: ${legacyPlayers.length}`);

//     const targetSeasonsCol = targetDb.collection("xplseasons");
//     const targetTeamsCol = targetDb.collection("xplteams");
//     const targetRegistrationsCol = targetDb.collection("xplregistrations");

//     const seasons = [1, 2, 3];

//     for (const seasonNum of seasons) {
//       console.log(`\n========================================`);
//       console.log(`  Processing Season ${seasonNum}`);
//       console.log(`========================================`);

//       const currentSeasonTeams = legacyTeams.filter(
//         (t) => String(t.season).trim() === String(seasonNum),
//       );
//       const currentSeasonPlayers = legacyPlayers.filter(
//         (p) => String(p.season).trim() === String(seasonNum),
//       );

//       console.log(`Season ${seasonNum} Teams: ${currentSeasonTeams.length}`);
//       console.log(
//         `Season ${seasonNum} Players: ${currentSeasonPlayers.length}`,
//       );

//       let winningTeamId = null;

//       // --- A: Insert / Update Teams in xplteams ---
//       for (const t of currentSeasonTeams) {
//         const teamName = t.teamName ? t.teamName.trim() : "Unknown Team";

//         // Only acquire players that were actually bought (price > 0)
//         const acquiredPlayers = currentSeasonPlayers.filter((p) => {
//           const finalPrice = Number(p.price) || 0;
//           return (
//             finalPrice > 0 &&
//             p.boughtBy &&
//             p.boughtBy.trim().toLowerCase() === teamName.toLowerCase()
//           );
//         });

//         const rosterData = acquiredPlayers.map((p) => ({
//           _id: new ObjectId(),
//           platoId: (p.playerName || "ANONYMOUS").toUpperCase(),
//           playerName: p.playerName || "Player",
//           boughtPrice: Number(p.price) || 0,
//         }));

//         const autoTag = teamName
//           .split(" ")
//           .map((w) => w[0])
//           .join("")
//           .toUpperCase()
//           .slice(0, 4);

//         const teamPayload = {
//           seasonNumber: Number(seasonNum),
//           teamName: teamName,
//           teamTag: autoTag || "XPL",
//           ownerName: t.ownerName || "Community Owner",
//           ownerPlatoId: t.ownerName || "N/A",
//           logoUrl: "/images/default-team.png",
//           remainingBudget: 0,
//           roster: rosterData,
//           updatedAt: new Date(),
//         };

//         await targetTeamsCol.updateOne(
//           { seasonNumber: Number(seasonNum), teamName: teamName },
//           { $set: teamPayload, $setOnInsert: { createdAt: new Date() } },
//           { upsert: true },
//         );

//         const savedTeam = await targetTeamsCol.findOne({
//           seasonNumber: Number(seasonNum),
//           teamName: teamName,
//         });

//         if (t.isWinner && savedTeam) {
//           winningTeamId = savedTeam._id;
//           console.log(
//             `⭐ Identified Champion for Season ${seasonNum}: ${teamName}`,
//           );
//         }
//       }

//       // --- B: Insert / Update Players in xplregistrations ---
//       for (const p of currentSeasonPlayers) {
//         const finalPrice = Number(p.price) || 0;
//         const isSold = finalPrice > 0; // Sold if final bid price > 0; otherwise unsold
//         const playerName = p.playerName ? p.playerName.trim() : "Unknown";
//         const sanitizedPlayerKey = playerName
//           .toLowerCase()
//           .replace(/[^a-z0-9]/g, "_");

//         const placeholderEmail = `legacy_${sanitizedPlayerKey}_s${seasonNum}@atx.internal`;

//         await targetRegistrationsCol.updateOne(
//           { seasonNumber: Number(seasonNum), playerName: playerName },
//           {
//             $set: {
//               seasonNumber: Number(seasonNum),
//               playerName: playerName,
//               platoId: playerName.toUpperCase(),
//               userEmail: placeholderEmail,
//               basePrice: 100,
//               status: isSold ? "sold" : "unsold",
//               boughtBy: isSold ? (p.boughtBy ? p.boughtBy.trim() : null) : null,
//               soldPrice: finalPrice,
//               preferredGames: "Legacy Player",
//               aboutPlayer: "Participated in legacy XPL season.",
//               updatedAt: new Date(),
//             },
//             $setOnInsert: { createdAt: new Date() },
//           },
//           { upsert: true },
//         );
//       }

//       // --- C: Insert / Update Season in xplseasons ---
//       await targetSeasonsCol.updateOne(
//         { seasonNumber: Number(seasonNum) },
//         {
//           $set: {
//             seasonNumber: Number(seasonNum),
//             seasonRoman: ROMAN_MAP[seasonNum] || `${seasonNum}`,
//             status: "ended",
//             isRegistrationOpen: false,
//             championTeam: winningTeamId || null,
//             updatedAt: new Date(),
//           },
//           $setOnInsert: { createdAt: new Date() },
//         },
//         { upsert: true },
//       );
//     }

//     // Live Verification Counts
//     console.log(`\n--- Live Verification in ATX-Family-v2 ---`);
//     const countSeasons = await targetSeasonsCol.countDocuments();
//     const countTeams = await targetTeamsCol.countDocuments();
//     const countSold = await targetRegistrationsCol.countDocuments({
//       status: "sold",
//     });
//     const countUnsold = await targetRegistrationsCol.countDocuments({
//       status: "unsold",
//     });
//     const countTotalRegs = await targetRegistrationsCol.countDocuments();

//     console.log(`xplseasons: ${countSeasons} docs`);
//     console.log(`xplteams: ${countTeams} docs`);
//     console.log(
//       `xplregistrations: ${countTotalRegs} total (Sold: ${countSold}, Unsold: ${countUnsold})`,
//     );

//     console.log(
//       "\n🎉 [COMPLETE] Migration finished and all records updated accurately!",
//     );
//   } catch (err) {
//     console.error("[FATAL MIGRATION ERROR]", err);
//   } finally {
//     await client.close();
//     process.exit(0);
//   }
// }

// runCrossDatabaseMigration();
