// models/SiteSetting.js
const mongoose = require("mongoose");

const siteSettingSchema = new mongoose.Schema(
  {
    totalPrizeSponsored: { type: Number, default: 0 },
    discordServerLink: { type: String, default: "" },
    customMetrics: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("SiteSetting", siteSettingSchema);
