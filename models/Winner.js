const mongoose = require("mongoose");

const winnerSchema = new mongoose.Schema(
  {
    winnerName: {
      type: String,
      required: true,
      trim: true,
    },
    gameName: {
      type: String,
      required: true,
      trim: true,
    },
    date: { type: Date, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Winner", winnerSchema);
