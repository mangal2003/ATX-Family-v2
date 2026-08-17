const express = require("express");
const router = express.Router();
const User = require("../models/User");

let cachedEvent = null;

// Emergency local bank (20+ terms)
const FALLBACK_BANK = [
  { word: "PHANTOM", hint: "A ghost or spirit that haunts shadows" },
  { word: "VORTEX", hint: "A whirling mass of cyber or magical energy" },
  { word: "VALIANT", hint: "Showing courage or determination" },
  { word: "TACTICAL", hint: "Carefully planned actions to gain advantage" },
  { word: "CIPHER", hint: "A secret or disguised way of writing code" },
  { word: "DOMINION", hint: "Sovereignty or supreme control" },
  { word: "BASTION", hint: "A fortified stronghold or defensive position" },
  { word: "WARLOCK", hint: "A practitioner of mystical combat sorcery" },
  { word: "OVERDRIVE", hint: "A state of high speed and intense power" },
  {
    word: "RENEGADE",
    hint: "An individual who rebels against conventional rules",
  },
  { word: "GUARDIAN", hint: "A defender who protects an asset or realm" },
  { word: "GLADIATOR", hint: "A fighter who engages in arena combat" },
];

function scrambleWord(str) {
  const arr = str.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const res = arr.join("");
  return res === str ? scrambleWord(str) : res;
}

// Single-step API fetch using Datamuse pattern matching
async function fetchDynamicWordAndHint() {
  try {
    const lengths = [5, 6, 7];
    const len = lengths[Math.floor(Math.random() * lengths.length)];
    const pattern = "?".repeat(len);

    const topics = [
      "game",
      "battle",
      "war",
      "mind",
      "power",
      "cyber",
      "clan",
      "space",
      "arena",
      "magic",
      "code",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const url = `https://api.datamuse.com/words?sp=${pattern}&topics=${topic}&md=d&max=100`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });

    if (!res.ok) throw new Error(`Datamuse returned HTTP ${res.status}`);

    const wordsList = await res.json();

    const validEntries = wordsList.filter(
      (item) =>
        item.word &&
        /^[a-zA-Z]+$/.test(item.word) &&
        Array.isArray(item.defs) &&
        item.defs.length > 0,
    );

    if (validEntries.length > 0) {
      const selected =
        validEntries[Math.floor(Math.random() * validEntries.length)];
      const rawDef = selected.defs[0].replace(/^[a-z]+\t/, "");
      const cleanHint = rawDef.charAt(0).toUpperCase() + rawDef.slice(1);

      console.log(
        `[VAULT API SUCCESS] -> Word: ${selected.word.toUpperCase()} | Hint: ${cleanHint}`,
      );
      return {
        word: selected.word.toUpperCase(),
        hint: cleanHint,
      };
    }
  } catch (err) {
    console.error("[VAULT API ERROR]", err.message);
  }

  const fallback =
    FALLBACK_BANK[Math.floor(Math.random() * FALLBACK_BANK.length)];
  console.log(`[VAULT LOCAL FALLBACK] -> Word: ${fallback.word}`);
  return fallback;
}

function getCurrentHourId() {
  return new Date().getUTCHours();
}

async function getVaultEvent() {
  const currentHour = getCurrentHourId();

  if (cachedEvent && cachedEvent.hourId === currentHour) {
    return cachedEvent;
  }

  const isGiveaway = currentHour % 2 === 0; // Even Hour = Giveaway, Odd Hour = Cipher
  const dynamicItem = await fetchDynamicWordAndHint();
  const scrambled = scrambleWord(dynamicItem.word);

  cachedEvent = {
    hourId: currentHour,
    type: isGiveaway ? "GIVEAWAY" : "CIPHER",
    title: isGiveaway ? "⚡ FLASH VAULT DROP" : "🧠 CIPHER DECRYPTION GAUNTLET",
    reward: 500,
    hint: dynamicItem.hint,
    scrambled: scrambled,
    rawWord: dynamicItem.word,
  };

  return cachedEvent;
}

// GET /vault
router.get("/", async (req, res) => {
  const event = await getVaultEvent();
  let hasClaimedHourlyEvent = false;

  if (req.user) {
    const user = await User.findById(req.user._id).select("vaultStats");
    if (user?.vaultStats?.lastEventClaimHour === event.hourId) {
      hasClaimedHourlyEvent = true;
    }
  }

  res.render("vault", {
    title: "EP Cyber Vault & Terminal",
    event,
    hasClaimedHourlyEvent,
    user: req.user || null,
  });
});

// POST /vault/claim-giveaway
router.post("/claim-giveaway", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Active during the first 10 minutes of the hour
  if (currentMinute > 10) {
    return res.status(400).json({
      success: false,
      message: "This drop window has concluded for the current hour!",
    });
  }

  try {
    const user = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        "vaultStats.lastEventClaimHour": { $ne: currentHour },
      },
      {
        $inc: { xp: 500, xpBalance: 500 },
        $set: { "vaultStats.lastEventClaimHour": currentHour },
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "You already claimed this hour's reward!",
      });
    }

    res.json({
      success: true,
      message: "Claimed +500 EP from Flash Vault Drop!",
      newBalance: user.xpBalance ?? user.xp,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error processing claim." });
  }
});

// POST /vault/submit-cipher
router.post("/submit-cipher", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });
  }

  const { guess } = req.body;
  const event = await getVaultEvent();

  if (!guess || guess.trim().toUpperCase() !== event.rawWord) {
    return res
      .status(400)
      .json({ success: false, message: "Incorrect cipher solution!" });
  }

  try {
    const currentHour = getCurrentHourId();
    const user = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        "vaultStats.lastEventClaimHour": { $ne: currentHour },
      },
      {
        $inc: { xp: 500, xpBalance: 500 },
        $set: { "vaultStats.lastEventClaimHour": currentHour },
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "You already cracked this hour's cipher!",
      });
    }

    res.json({
      success: true,
      message: `Decryption Successful! [${event.rawWord}] decoded. +500 EP Granted.`,
      newBalance: user.xpBalance ?? user.xp,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error validating cipher." });
  }
});

// POST /vault/terminal-command
router.post("/terminal-command", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res
      .status(401)
      .json({ output: "AUTH REQUIRED: Please log in to run vault commands." });
  }

  const { command } = req.body;
  if (!command) return res.json({ output: "" });

  const parts = command.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();

  const user = await User.findById(req.user._id);
  const currentBalance = user.xpBalance ?? user.xp ?? 0;
  const currentHour = getCurrentHourId();

  // Reset hourly rate limits
  if (!user.vaultStats || user.vaultStats.lastRouletteHour !== currentHour) {
    user.vaultStats = {
      roulettePlaysThisHour: 0,
      coinflipPlaysThisHour: 0,
      dicePlaysThisHour: 0,
      slotsPlaysThisHour: 0,
      blackjackPlaysThisHour: 0,
      lastRouletteHour: currentHour,
    };
  }

  const parseBet = (arg) => {
    if (!arg) return NaN;
    if (arg.toLowerCase() === "all") return currentBalance;
    return parseInt(arg, 10);
  };

  // 1. HELP MENU
  if (cmd === "help") {
    return res.json({
      output: [
        "[ VAULT PROTOCOLS & COMMANDS ]",
        "---------------------------------------",
        "• roulette <red|black|gold|cyan> <bet>",
        "  └ Payout: 4.00x | Limit: 5/hr",
        "",
        "• coinflip <heads|tails> <bet>",
        "  └ Payout: 2.00x | Limit: 10/hr",
        "",
        "• dice <bet>",
        "  └ Payout: 2.50x | Limit: 10/hr",
        "",
        "• slots <bet>",
        "  └ Payout: Up to 15x | Limit: 10/hr",
        "",
        "• blackjack <bet>",
        "  └ Payout: 2.00x | Limit: 5/hr",
        "",
        "• balance  -> View wallet funds",
        "• clear    -> Reset console workspace",
        "-----------------------------------------",
        "Tip: Use 'all' as your bet amount to go all-in.",
      ].join("\n"),
    });
  }

  // 2. BALANCE INQUIRY
  if (cmd === "balance") {
    return res.json({
      output: `WALLET AUDIT: ${currentBalance.toLocaleString()} EP available.`,
    });
  }

  // 3. ROULETTE (4x Payout)
  if (cmd === "roulette") {
    const validColors = ["red", "black", "gold", "cyan"];
    const chosenColor = (parts[1] || "").toLowerCase();
    const betAmount = parseBet(parts[2]);

    if (!validColors.includes(chosenColor)) {
      return res.json({
        output: "SYNTAX ERROR: roulette <red|black|gold|cyan> <amount|all>",
      });
    }
    if (isNaN(betAmount) || betAmount < 20) {
      return res.json({ output: "ERROR: Minimum bet is 20 EP." });
    }
    if (betAmount > currentBalance) {
      return res.json({
        output: `ERROR: Insufficient funds (${currentBalance.toLocaleString()} EP available).`,
      });
    }
    if ((user.vaultStats.roulettePlaysThisHour || 0) >= 5) {
      return res.json({
        output: "RATE LIMIT: 5 roulette rounds reached for this hour.",
      });
    }

    const winningColor =
      validColors[Math.floor(Math.random() * validColors.length)];
    const isWin = chosenColor === winningColor;
    const delta = isWin ? betAmount * 3 : -betAmount;

    user.xp = currentBalance + delta;
    user.xpBalance = user.xp;
    user.vaultStats.roulettePlaysThisHour =
      (user.vaultStats.roulettePlaysThisHour || 0) + 1;
    await user.save();

    return res.json({
      newBalance: user.xp,
      output: [
        `[ROULETTE] 🎡 Spinning wheel... Ball lands on: [ ${winningColor.toUpperCase()} ]`,
        isWin
          ? `🎉 VICTORY! Your prediction was correct! +${(betAmount * 4).toLocaleString()} EP (Profit: +${(betAmount * 3).toLocaleString()})`
          : `💀 DEFEAT. Lost ${betAmount.toLocaleString()} EP.`,
        `New Balance: ${user.xp.toLocaleString()} EP | Remaining Plays: ${5 - user.vaultStats.roulettePlaysThisHour}`,
      ].join("\n"),
    });
  }

  // 4. COINFLIP (2x Payout)
  if (cmd === "coinflip" || cmd === "cf") {
    const choice = (parts[1] || "").toLowerCase();
    const validSides = ["heads", "tails", "h", "t"];
    const betAmount = parseBet(parts[2]);

    if (!validSides.includes(choice)) {
      return res.json({
        output: "SYNTAX ERROR: coinflip <heads|tails> <amount|all>",
      });
    }
    if (isNaN(betAmount) || betAmount < 20) {
      return res.json({ output: "ERROR: Minimum bet is 20 EP." });
    }
    if (betAmount > currentBalance) {
      return res.json({
        output: `ERROR: Insufficient funds (${currentBalance.toLocaleString()} EP available).`,
      });
    }
    if ((user.vaultStats.coinflipPlaysThisHour || 0) >= 10) {
      return res.json({
        output: "RATE LIMIT: 10 coinflip rounds reached for this hour.",
      });
    }

    const normalizedChoice = choice.startsWith("h") ? "heads" : "tails";
    const outcome = Math.random() < 0.5 ? "heads" : "tails";
    const isWin = normalizedChoice === outcome;
    const delta = isWin ? betAmount : -betAmount;

    user.xp = currentBalance + delta;
    user.xpBalance = user.xp;
    user.vaultStats.coinflipPlaysThisHour =
      (user.vaultStats.coinflipPlaysThisHour || 0) + 1;
    await user.save();

    return res.json({
      newBalance: user.xp,
      output: [
        `[COINFLIP] 🪙 Flipping cyber coin... Result: [ ${outcome.toUpperCase()} ]`,
        isWin
          ? `🎉 VICTORY! Called ${normalizedChoice.toUpperCase()} correctly! +${(betAmount * 2).toLocaleString()} EP`
          : `💀 DEFEAT. Coin flipped to ${outcome.toUpperCase()}. Lost ${betAmount.toLocaleString()} EP.`,
        `New Balance: ${user.xp.toLocaleString()} EP | Remaining Plays: ${10 - user.vaultStats.coinflipPlaysThisHour}`,
      ].join("\n"),
    });
  }

  // 5. DICE DUEL (2.5x Payout - Beat the House Roll)
  if (cmd === "dice") {
    const betAmount = parseBet(parts[1]);

    if (isNaN(betAmount) || betAmount < 20) {
      return res.json({
        output: "SYNTAX ERROR: dice <amount|all> (Min 20 EP)",
      });
    }
    if (betAmount > currentBalance) {
      return res.json({
        output: `ERROR: Insufficient funds (${currentBalance.toLocaleString()} EP available).`,
      });
    }
    if ((user.vaultStats.dicePlaysThisHour || 0) >= 10) {
      return res.json({
        output: "RATE LIMIT: 10 dice duels reached for this hour.",
      });
    }

    const playerRoll =
      Math.floor(Math.random() * 6) + 1 + (Math.floor(Math.random() * 6) + 1);
    const houseRoll =
      Math.floor(Math.random() * 6) + 1 + (Math.floor(Math.random() * 6) + 1);

    let delta = 0;
    let resultMsg = "";

    if (playerRoll > houseRoll) {
      const winnings = Math.floor(betAmount * 1.5);
      delta = winnings;
      resultMsg = `🎉 VICTORY! You outrolled the house! +${(betAmount + winnings).toLocaleString()} EP (Profit: +${winnings.toLocaleString()})`;
    } else if (playerRoll === houseRoll) {
      delta = 0;
      resultMsg = `⚖️ TIE! Both rolled ${playerRoll}. Bet refunded.`;
    } else {
      delta = -betAmount;
      resultMsg = `💀 DEFEAT! House wins with ${houseRoll}. Lost ${betAmount.toLocaleString()} EP.`;
    }

    user.xp = currentBalance + delta;
    user.xpBalance = user.xp;
    user.vaultStats.dicePlaysThisHour =
      (user.vaultStats.dicePlaysThisHour || 0) + 1;
    await user.save();

    return res.json({
      newBalance: user.xp,
      output: [
        `[DICE DUEL] 🎲 Your Roll: [ ${playerRoll} ] vs Vault House: [ ${houseRoll} ]`,
        resultMsg,
        `New Balance: ${user.xp.toLocaleString()} EP | Remaining Plays: ${10 - user.vaultStats.dicePlaysThisHour}`,
      ].join("\n"),
    });
  }

  // 6. CYBER SLOTS (Up to 15x Payout)
  if (cmd === "slots" || cmd === "slot") {
    const betAmount = parseBet(parts[1]);

    if (isNaN(betAmount) || betAmount < 20) {
      return res.json({
        output: "SYNTAX ERROR: slots <amount|all> (Min 20 EP)",
      });
    }
    if (betAmount > currentBalance) {
      return res.json({
        output: `ERROR: Insufficient funds (${currentBalance.toLocaleString()} EP available).`,
      });
    }
    if ((user.vaultStats.slotsPlaysThisHour || 0) >= 10) {
      return res.json({
        output: "RATE LIMIT: 10 slot spins reached for this hour.",
      });
    }

    const symbols = ["💎", "⚡", "🪙", "💀", "👑"];
    const r1 = symbols[Math.floor(Math.random() * symbols.length)];
    const r2 = symbols[Math.floor(Math.random() * symbols.length)];
    const r3 = symbols[Math.floor(Math.random() * symbols.length)];

    let multiplier = 0;
    if (r1 === "👑" && r2 === "👑" && r3 === "👑") multiplier = 15;
    else if (r1 === "💎" && r2 === "💎" && r3 === "💎") multiplier = 10;
    else if (r1 === r2 && r2 === r3 && r1 !== "💀") multiplier = 5;
    else if (r1 === r2 || r2 === r3 || r1 === r3) multiplier = 1.5;

    const isWin = multiplier > 0;
    const delta = isWin ? Math.floor(betAmount * (multiplier - 1)) : -betAmount;

    user.xp = currentBalance + delta;
    user.xpBalance = user.xp;
    user.vaultStats.slotsPlaysThisHour =
      (user.vaultStats.slotsPlaysThisHour || 0) + 1;
    await user.save();

    return res.json({
      newBalance: user.xp,
      output: [
        `[SLOTS] 🎰 [ ${r1} | ${r2} | ${r3} ]`,
        isWin
          ? `🎉 JACKPOT (${multiplier}x)! Won ${Math.floor(betAmount * multiplier).toLocaleString()} EP (Profit: +${delta.toLocaleString()})`
          : `💀 NO MATCH. Lost ${betAmount.toLocaleString()} EP.`,
        `New Balance: ${user.xp.toLocaleString()} EP | Remaining Plays: ${10 - user.vaultStats.slotsPlaysThisHour}`,
      ].join("\n"),
    });
  }

  // 7. INSTANT BLACKJACK / 21 (2x Payout)
  if (cmd === "blackjack" || cmd === "bj" || cmd === "21") {
    const betAmount = parseBet(parts[1]);

    if (isNaN(betAmount) || betAmount < 20) {
      return res.json({
        output: "SYNTAX ERROR: blackjack <amount|all> (Min 20 EP)",
      });
    }
    if (betAmount > currentBalance) {
      return res.json({
        output: `ERROR: Insufficient funds (${currentBalance.toLocaleString()} EP available).`,
      });
    }
    if ((user.vaultStats.blackjackPlaysThisHour || 0) >= 5) {
      return res.json({
        output: "RATE LIMIT: 5 blackjack hands reached for this hour.",
      });
    }

    const drawHand = () => {
      const card1 = Math.min(10, Math.floor(Math.random() * 11) + 1);
      const card2 = Math.min(10, Math.floor(Math.random() * 11) + 1);
      return card1 + card2;
    };

    const playerTotal = drawHand();
    const dealerTotal = drawHand();

    let delta = 0;
    let outcomeText = "";

    if (playerTotal === 21 && dealerTotal !== 21) {
      delta = Math.floor(betAmount * 1.5);
      outcomeText = `👑 NATURAL BLACKJACK (21)! +${(betAmount + delta).toLocaleString()} EP!`;
    } else if (playerTotal > dealerTotal) {
      delta = betAmount;
      outcomeText = `🎉 VICTORY! Your [${playerTotal}] beat Dealer [${dealerTotal}]. +${(betAmount * 2).toLocaleString()} EP!`;
    } else if (playerTotal === dealerTotal) {
      delta = 0;
      outcomeText = `⚖️ PUSH! Both stood at [${playerTotal}]. Bet refunded.`;
    } else {
      delta = -betAmount;
      outcomeText = `💀 DEALER WINS! Dealer [${dealerTotal}] beat your [${playerTotal}]. Lost ${betAmount.toLocaleString()} EP.`;
    }

    user.xp = currentBalance + delta;
    user.xpBalance = user.xp;
    user.vaultStats.blackjackPlaysThisHour =
      (user.vaultStats.blackjackPlaysThisHour || 0) + 1;
    await user.save();

    return res.json({
      newBalance: user.xp,
      output: [
        `[BLACKJACK] 🃏 Player Hand: [ ${playerTotal} ] vs Dealer Hand: [ ${dealerTotal} ]`,
        outcomeText,
        `New Balance: ${user.xp.toLocaleString()} EP | Remaining Plays: ${5 - user.vaultStats.blackjackPlaysThisHour}`,
      ].join("\n"),
    });
  }

  return res.json({
    output: `Command '${cmd}' not recognized. Type 'help' for available games.`,
  });
});

module.exports = router;
