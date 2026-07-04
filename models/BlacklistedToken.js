const mongoose = require("mongoose");

const blacklistedTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL Index: Auto-delete tokens after 7 days (604800 seconds)
blacklistedTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model("BlacklistedToken", blacklistedTokenSchema);
