const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    code: {
      type: String,
      required: [true, "Supplier code is required"],
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    company: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: "Pakistan",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: "30 days credit",
    },
    taxId: {
      type: String,
      trim: true,
    },
    totalPurchases: {
      type: Number,
      default: 0,
      min: [0, "Total purchases cannot be negative"],
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, category: 1 });
supplierSchema.index({ tenantId: 1, code: 1 });
supplierSchema.index({ tenantId: 1, email: 1 });
supplierSchema.index({ tenantId: 1, phone: 1 });
supplierSchema.index({ tenantId: 1, createdAt: -1 });
supplierSchema.index({ tenantId: 1, updatedAt: -1 });

module.exports = mongoose.model("Supplier", supplierSchema);
