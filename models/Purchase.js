const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    // Top Fields
    serialNo: {
      type: String,
      required: [true, "Serial number is required"],
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      required: [true, "Purchase date is required"],
      default: Date.now,
    },
    purchaseOrderNo: {
      type: String,
      required: [true, "Purchase order number is required"],
      trim: true,
    },
    vendorInvoiceNo: {
      type: String,
      required: [true, "Vendor invoice number is required"],
      trim: true,
    },

    // Vendor Details
    vendorCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    vendorName: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    vendorAddress: {
      type: String,
      trim: true,
    },
    vendorPhone: {
      type: String,
      trim: true,
    },

    // Inventory Information
    inventoryLocation: {
      type: String,
      trim: true,
    },
    employeeReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Optional: Project reference
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },

    // Item Details - Reference to Item model
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: [true, "Item is required"],
    },
    itemCode: {
      type: String,
      required: [true, "Item code is required"],
      trim: true,
    },
    itemName: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Quantity and Pricing
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
    unit: {
      type: String,
      required: [true, "Unit is required"],
      trim: true,
    },
    rate: {
      type: Number,
      required: [true, "Rate is required"],
      min: [0, "Rate cannot be negative"],
    },

    // Amounts
    grossAmount: {
      type: Number,
      default: 0,
      min: [0, "Gross amount cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    netAmount: {
      type: Number,
      required: [true, "Net amount is required"],
      min: [0, "Net amount cannot be negative"],
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "completed", "cancelled"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Audit field
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Payment Tracking
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    payments: [
      {
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BankPayment",
        },
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          required: true,
        },
        description: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
purchaseSchema.index({ tenantId: 1, date: -1 });
purchaseSchema.index({ tenantId: 1, vendorName: 1 });
purchaseSchema.index({ tenantId: 1, item: 1 });
purchaseSchema.index({ tenantId: 1, purchaseOrderNo: 1 });
purchaseSchema.index({ tenantId: 1, item: 1, date: -1 });
purchaseSchema.index({ tenantId: 1, project: 1, date: -1 });
purchaseSchema.index({ tenantId: 1, paymentStatus: 1 });

// Pre-save middleware to calculate amounts, payment status, and track if document is new
purchaseSchema.pre("save", async function () {
  // Track if document is new (for post-save hook)
  this.wasNew = this.isNew;

  // Calculate gross amount if not provided
  if (!this.grossAmount || this.grossAmount === 0) {
    this.grossAmount = this.quantity * this.rate;
  }

  // Calculate net amount
  this.netAmount = this.grossAmount - (this.discount || 0);

  // Update payment status based on amountPaid
  if (this.amountPaid === 0) {
    this.paymentStatus = "unpaid";
  } else if (this.amountPaid >= this.netAmount) {
    this.paymentStatus = "paid";
  } else {
    this.paymentStatus = "partial";
  }
});

// Post-save middleware to create journal entry for accounting
purchaseSchema.post("save", async function (doc) {
  // Only create journal entry if this is a new purchase (not an update)
  if (this.wasNew && doc.status !== "cancelled") {
    try {
      const AccountingService = require("../services/accountingService");

      // Get the user who created the purchase (default to first admin if not available)
      let userId = doc.createdBy;
      if (!userId) {
        const User = require("./User");
        const admin = await User.findOne({ role: "admin" });
        userId = admin ? admin._id : null;
      }

      if (userId) {
        console.log(
          "Creating journal entry for purchase:",
          doc.purchaseOrderNo
        );
        const journalEntry = await AccountingService.createPurchaseJournalEntry(
          doc,
          userId
        );
        console.log(
          "✓ Journal entry created successfully:",
          journalEntry.entryNumber
        );
      } else {
        console.error("❌ No user ID found for journal entry creation");
      }
    } catch (error) {
      console.error(
        "❌ Error creating journal entry for purchase:",
        error.message
      );
      console.error("Error stack:", error.stack);
      if (doc.$session && doc.$session()) {
        throw error;
      }
    }
  }
});

// Indexes for tenant isolation and queries
purchaseSchema.index({ tenantId: 1 });
purchaseSchema.index({ tenantId: 1, serialNo: 1 });
purchaseSchema.index({ tenantId: 1, vendorCode: 1 });
purchaseSchema.index({ tenantId: 1, createdAt: -1 });
purchaseSchema.index({ tenantId: 1, updatedAt: -1 });

module.exports = mongoose.model("Purchase", purchaseSchema);
