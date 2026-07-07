const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: null,
    },
    clerkId: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
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
    password: {
      type: String,
      required: false,
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
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
  },
  {
    timestamps: true,
  }
);

// Ensure unique email globally
userSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
