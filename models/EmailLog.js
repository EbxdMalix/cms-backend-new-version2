const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["SYSTEM", "SUPPORT"],
      required: true,
      default: "SYSTEM",
    },
    to: {
      type: [String],
      required: true,
    },
    from: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    tenantId: {
      type: String,
      default: null,
      index: true,
    },
    resendEmailId: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Email logs are append-only
  }
);

emailLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
