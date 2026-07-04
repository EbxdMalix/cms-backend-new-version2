const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    client: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    telephone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    contact: {
      type: String,
      trim: true,
    },
    jobNo: {
      type: String,
      trim: true,
    },
    jobDescription: {
      type: String,
      trim: true,
    },
    orderNo: {
      type: String,
      trim: true,
    },
    orderDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    deliveryDate: {
      type: Date,
    },
    valueOfJob: {
      type: Number,
      min: [0, "Value must be a positive number"],
    },
    jobCompleted: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    completionDate: {
      type: Date,
      required: [true, "Completion date is required"],
    },
    estimatedCost: {
      type: Number,
      required: [true, "Estimated cost is required"],
      min: [0, "Estimated cost must be a positive number"],
    },
    jobIncharge: {
      type: String,
      required: [true, "Job incharge is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for tenant isolation and queries
projectSchema.index({ tenantId: 1 });
projectSchema.index({ tenantId: 1, status: 1 });
projectSchema.index({ tenantId: 1, createdAt: -1 });
projectSchema.index({ tenantId: 1, updatedAt: -1 });

module.exports = mongoose.model("Project", projectSchema);
