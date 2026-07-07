const mongoose = require("mongoose");

const userPortalAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "operator", "custom"],
      default: "operator",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    customPermissions: {
      type: {
        dashboard: { type: Boolean, default: false },
        projects: { type: Boolean, default: false },
        plots: { type: Boolean, default: false },
        customers: { type: Boolean, default: false },
        suppliers: { type: Boolean, default: false },
        items: { type: Boolean, default: false },
        chartOfAccounts: { type: Boolean, default: false },
        salesInvoice: { type: Boolean, default: false },
        purchaseEntry: { type: Boolean, default: false },
        cashPayment: { type: Boolean, default: false },
        bankPayment: { type: Boolean, default: false },
        reports: { type: Boolean, default: false },
        accounting: { type: Boolean, default: false },
        finance: { type: Boolean, default: false },
        crm: { type: Boolean, default: false },
        hr: { type: Boolean, default: false },
        documents: { type: Boolean, default: false },
        analytics: { type: Boolean, default: false },
      },
      default: null,
    },
    isDefaultPortal: {
      type: Boolean,
      default: false,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    permissionVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only have one membership entry per tenant
userPortalAccessSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model("UserPortalAccess", userPortalAccessSchema);
