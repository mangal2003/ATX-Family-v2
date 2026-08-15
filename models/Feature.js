const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: true,
      default: "💎" || "fa-solid fa-cube",
    },
    heading: {
      type: String,
      required: true,
    },
    about: {
      type: String,
      required: true,
    },
    bgImage: {
      type: String,
      default: "/images/default-feature-bg.jpg",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Feature", featureSchema);
