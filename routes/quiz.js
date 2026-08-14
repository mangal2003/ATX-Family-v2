const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/User");
const { ensureAuth } = require("../middleware/auth");

/**
 * Helper: Check if current time falls within an even IST hour window (00:00 to 00:30)
 */
function isQuizWindowActive() {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // UTC + 5:30
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();

  const isEvenHour = hours % 2 === 0;
  const isWithin30Mins = minutes < 30;

  return isEvenHour && isWithin30Mins;
}

/**
 * Helper: Get Current Even-Hour Slot Identifier in IST
 */
function getCurrentQuizSlot() {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const date = String(istTime.getUTCDate()).padStart(2, "0");
  const hours = istTime.getUTCHours();
  const evenHour = hours - (hours % 2);

  return `${year}-${month}-${date}-${String(evenHour).padStart(2, "0")}`;
}

// GET /quiz - Leaderboard & Window Check
router.get("/", ensureAuth, async (req, res) => {
  try {
    const isActive = isQuizWindowActive();
    const currentSlot = getCurrentQuizSlot();

    const hasAttempted = req.user.lastQuizSlot === currentSlot;

    const leaderboard = await User.find({ weeklyScore: { $gt: 0 } })
      .select("username weeklyScore quizzesCompleted")
      .sort({ weeklyScore: -1 })
      .limit(20)
      .lean();

    res.render("quiz", {
      title: "Quiz & Leaderboard | ATX Family",
      isActive,
      hasAttempted,
      leaderboard,
      user: req.user,
    });
  } catch (err) {
    console.error("Error loading quiz page:", err);
    req.flash("error_msg", "Failed to load quiz module.");
    res.redirect("/");
  }
});

// GET /quiz/questions - Fetch Questions
router.get("/questions", ensureAuth, async (req, res) => {
  if (!isQuizWindowActive()) {
    return res
      .status(403)
      .json({ success: false, message: "Quiz window is currently closed." });
  }

  const currentSlot = getCurrentQuizSlot();
  if (req.user.lastQuizSlot === currentSlot) {
    return res.status(403).json({
      success: false,
      message: "You have already completed your quiz attempt for this window.",
    });
  }

  try {
    const response = await axios.get(
      "https://opentdb.com/api.php?amount=10&type=multiple",
    );
    const rawQuestions = response.data.results || [];

    const formattedQuestions = rawQuestions.map((q, idx) => {
      const options = [...q.incorrect_answers, q.correct_answer].sort(
        () => Math.random() - 0.5,
      );
      return {
        id: idx + 1,
        question: q.question,
        options,
        correctAnswer: q.correct_answer,
      };
    });

    res.json({ success: true, questions: formattedQuestions });
  } catch (err) {
    console.error("Error fetching questions API:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve questions." });
  }
});

// POST /quiz/submit - Process Final Score
router.post("/submit", ensureAuth, async (req, res) => {
  try {
    const currentSlot = getCurrentQuizSlot();

    if (req.user.lastQuizSlot === currentSlot) {
      return res.status(400).json({
        success: false,
        message: "Attempt already recorded for this slot.",
      });
    }

    const { correctCount = 0, wrongCount = 0, skippedCount = 0 } = req.body;

    const correct = parseInt(correctCount, 10) || 0;
    const wrong = parseInt(wrongCount, 10) || 0;
    const skipped = parseInt(skippedCount, 10) || 0;

    // Calculated Score (+10 correct, -1 wrong/skipped)
    const calculatedScore = correct * 10 - wrong * 1 - skipped * 1;

    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        weeklyScore: calculatedScore,
        quizzesCompleted: 1,
      },
      $set: {
        lastQuizSlot: currentSlot,
      },
    });

    res.json({
      success: true,
      score: calculatedScore,
      correct,
      wrong,
      skipped,
    });
  } catch (err) {
    console.error("Error saving quiz score:", err);
    res
      .status(500)
      .json({ success: false, message: "Score calculation failed." });
  }
});

module.exports = router;
