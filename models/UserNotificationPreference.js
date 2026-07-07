const mongoose = require("mongoose");

const userNotificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: String,
      required: true,
    },
    preferences: {
      project_created: { type: Boolean, default: true },
      project_updated: { type: Boolean, default: true },
      sales_invoice_created: { type: Boolean, default: true },
      cash_payment_created: { type: Boolean, default: true },
      bank_payment_created: { type: Boolean, default: true },
      purchase_entry_created: { type: Boolean, default: true },
      plot_created: { type: Boolean, default: true },
      customer_created: { type: Boolean, default: true },
      supplier_created: { type: Boolean, default: true },
      user_created: { type: Boolean, default: true },
      request_created: { type: Boolean, default: true },
      request_approved: { type: Boolean, default: true },
      request_rejected: { type: Boolean, default: true },
      login_success: { type: Boolean, default: true },
      login_failed: { type: Boolean, default: true },
      password_changed: { type: Boolean, default: true },
      role_changed: { type: Boolean, default: true },
      permission_changed: { type: Boolean, default: true },
      system_notification: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userNotificationPreferenceSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model("UserNotificationPreference", userNotificationPreferenceSchema);
