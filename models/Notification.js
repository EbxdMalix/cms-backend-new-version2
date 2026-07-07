const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // System notifications won't have a sender
    },
    type: {
      type: String,
      enum: [
        "request_created",
        "request_approved",
        "request_rejected",
        "project_created",
        "project_updated",
        "sales_invoice_created",
        "cash_payment_created",
        "bank_payment_created",
        "purchase_entry_created",
        "plot_created",
        "customer_created",
        "supplier_created",
        "user_created",
        "login_success",
        "login_failed",
        "password_changed",
        "role_changed",
        "permission_changed",
        "system_notification",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      enum: [
        "project",
        "sales_invoice",
        "cash_payment",
        "bank_payment",
        "purchase_entry",
        "plot",
        "customer",
        "supplier",
        "user",
        "request_approval",
        "security",
      ],
      required: false,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({
  tenantId: 1,
  recipient: 1,
  isRead: 1,
  createdAt: -1,
});
notificationSchema.index(
  { tenantId: 1, createdAt: 1 },
  { expireAfterSeconds: 2592000 }
); // Auto-delete after 30 days

module.exports = mongoose.model("Notification", notificationSchema);
