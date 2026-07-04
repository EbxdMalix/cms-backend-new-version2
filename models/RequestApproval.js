const mongoose = require("mongoose");

const requestApprovalSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestType: {
      type: String,
      enum: [
        "create_project",
        "edit_project",
        "delete_project",
        "create_sales_invoice",
        "edit_sales_invoice",
        "delete_sales_invoice",
        "create_cash_payment",
        "edit_cash_payment",
        "delete_cash_payment",
        "create_bank_payment",
        "edit_bank_payment",
        "delete_bank_payment",
        "create_purchase",
        "edit_purchase",
        "delete_purchase",
        "create_plot",
        "edit_plot",
        "delete_plot",
        "create_customer",
        "edit_customer",
        "delete_customer",
        "create_supplier",
        "edit_supplier",
        "delete_supplier",
        "create_user",
        "edit_user",
        "delete_user",
      ],
      required: true,
    },
    requestData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    originalData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Generic reference field for any entity being edited
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Deprecated - keeping for backward compatibility with existing project requests
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminResponse: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
requestApprovalSchema.index({ tenantId: 1, userId: 1, status: 1 });
requestApprovalSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
requestApprovalSchema.index({ tenantId: 1, status: 1 });
requestApprovalSchema.index({ tenantId: 1, requestType: 1 });
requestApprovalSchema.index({ tenantId: 1, createdAt: -1 });
requestApprovalSchema.index({ tenantId: 1, userId: 1 });

// Idempotency protection: prevent multiple pending requests for the same entity by same user
requestApprovalSchema.index(
  { tenantId: 1, entityId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending", entityId: { $type: "objectId" } }
  }
);

module.exports = mongoose.model("RequestApproval", requestApprovalSchema);
