const mongoose = require("mongoose");

const accountTypeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    name: {
      type: String,
      required: [true, "Account type name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Account type code is required"],
      trim: true,
      uppercase: true,
    },
    financialComponent: {
      type: String,
      required: [true, "Financial component is required"],
      enum: ["salary", "pay roll", "pr expenses", "miscellaneous expenses"],
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
accountTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });
accountTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("AccountType", accountTypeSchema);
