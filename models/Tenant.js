const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const tenantSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    portalName: {
      type: String,
      required: [true, "Portal name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    adminName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: "#3b82f6" }, // Tailwind blue
      secondaryColor: { type: String, default: "#8b5cf6" }, // Tailwind violet
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

// Hash password before saving
tenantSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
tenantSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Tenant", tenantSchema);
