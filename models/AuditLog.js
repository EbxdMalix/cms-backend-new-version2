const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["create", "update", "delete", "approve", "reject"],
      required: true,
    },
    entityType: {
      type: String, // E.g., "Project", "Plot", "SalesInvoice", etc.
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Audit logs are append-only
  }
);

// Compound indexes for report filtering & dashboard timeline
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
