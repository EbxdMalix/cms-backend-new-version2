const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    // Inventory Category
    categoryCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    categoryName: {
      type: String,
      trim: true,
    },

    // Sub Inventory Category
    subCategoryCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    subCategoryName: {
      type: String,
      trim: true,
    },

    // Inventory Item Information
    itemType: {
      type: String,
      enum: ["Material", "Equipment", "Plot", "Service"],
      default: "Material",
      trim: true,
    },
    itemCode: {
      type: String,
      required: [true, "Item code is required"],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    measurement: {
      type: String,
      required: [true, "Measurement unit is required"],
      trim: true,
    },

    // Pricing Information
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, "Purchase price cannot be negative"],
    },
    saleTaxRate: {
      type: Number,
      default: 0,
      min: [0, "Sale tax rate cannot be negative"],
      max: [100, "Sale tax rate cannot exceed 100%"],
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: [0, "Selling price cannot be negative"],
    },

    // Stock Information
    quantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    currentStock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    minStockLevel: {
      type: Number,
      default: 0,
      min: [0, "Minimum stock level cannot be negative"],
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
itemSchema.index({ tenantId: 1 });
itemSchema.index({ tenantId: 1, categoryCode: 1 });
itemSchema.index({ tenantId: 1, subCategoryCode: 1 });
itemSchema.index({ tenantId: 1, name: 1 });
itemSchema.index({ tenantId: 1, itemCode: 1 }, { unique: true });
itemSchema.index({ tenantId: 1, createdAt: -1 });
itemSchema.index({ tenantId: 1, updatedAt: -1 });

// Pre-save hook: Initialize currentStock with quantity (existing warehouse stock)
// When user creates an item, quantity represents what they already have in warehouse
// currentStock is then updated by purchases (adds stock) and sales (reduces stock)
itemSchema.pre("save", async function () {
  // Only for new items - set currentStock to quantity (existing warehouse stock)
  if (this.isNew) {
    this.currentStock = this.quantity;
  }
});

module.exports = mongoose.model("Item", itemSchema);
