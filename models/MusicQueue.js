// models/MusicQueue.js
const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  streamUrl: { type: String, required: true },
  thumbnail: { type: String, default: "" },
  duration: { type: Number, default: 0 },
  requestedBy: { type: String, required: true },
  requestedByAvatar: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const musicRoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, default: "global_lounge", unique: true },
    currentTrack: songSchema,
    trackStartedAt: { type: Date, default: null },
    queue: [songSchema],
    pendingSkip: {
      requestedBy: { type: String, default: null },
      status: { type: String, default: null },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MusicRoom", musicRoomSchema);
