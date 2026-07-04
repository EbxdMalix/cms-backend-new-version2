const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    code: {
      type: String,
      required: [true, "Customer code is required"],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    totalPurchase: {
      type: Number,
      default: 0,
      min: [0, "Total purchase cannot be negative"],
    },
    balance: {
      type: Number,
      default: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: [0, "Credit limit cannot be negative"],
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: "Cash",
    },
    taxId: {
      type: String,
      trim: true,
    },
    businessType: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
customerSchema.index({ tenantId: 1, email: 1 });
customerSchema.index({ tenantId: 1, name: 1 });
customerSchema.index({ tenantId: 1, code: 1 });
customerSchema.index({ tenantId: 1, phone: 1 });
customerSchema.index({ tenantId: 1, createdAt: -1 });
customerSchema.index({ tenantId: 1, updatedAt: -1 });

module.exports = mongoose.model("Customer", customerSchema);
