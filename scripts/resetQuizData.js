// Load environment variables from .env file
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User"); // Adjust path if needed

async function resetAllQuizData() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MongoDB Connection URI is missing in process.env");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    // Reset weeklyScore, quizzesCompleted, and lastQuizSlot for ALL users
    const result = await User.updateMany(
      {},
      {
        $set: {
          weeklyScore: 0,
          quizzesCompleted: 0,
          lastQuizSlot: "", // Clears attempt lock
        },
      },
    );

    console.log(
      `Successfully reset quiz data for ${result.modifiedCount} user document(s).`,
    );
    process.exit(0);
  } catch (err) {
    console.error("Reset Error:", err);
    process.exit(1);
  }
}

resetAllQuizData();
