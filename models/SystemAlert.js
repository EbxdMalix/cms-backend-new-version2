const mongoose = require("mongoose");

const systemAlertSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: false,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical"],
      required: true,
      default: "error",
    },
    type: {
      type: String,
      enum: [
        "API_ERROR",
        "DATABASE_ERROR",
        "EMAIL_FAILED",
        "SECURITY_ALERT",
        "PERMISSION_FAILURE",
        "PAYMENT_FAILURE",
        "VALIDATION_ERROR",
        "UNCAUGHT_EXCEPTION",
      ],
      required: true,
    },
    fingerprint: {
      type: String,
      required: false,
    },
    count: {
      type: Number,
      default: 1,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    stackTrace: {
      type: String,
      required: false,
    },
    endpoint: {
      type: String,
      required: false,
    },
    method: {
      type: String,
      required: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

systemAlertSchema.index({ tenantId: 1, severity: 1, createdAt: -1 });
systemAlertSchema.index({ fingerprint: 1, createdAt: -1 });
systemAlertSchema.index({ resolved: 1, createdAt: -1 });
systemAlertSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 }
);

module.exports = mongoose.model("SystemAlert", systemAlertSchema);
