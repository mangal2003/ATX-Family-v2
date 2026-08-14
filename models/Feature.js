const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: true,
      default: "fa-solid fa-cube", // Font Awesome icon class (e.g., 'fa-solid fa-shield-halved')
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
      default: "/images/default-feature-bg.jpg", // URL or Cloudinary path
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Feature", featureSchema);
