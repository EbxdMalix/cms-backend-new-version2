const mongoose = require("mongoose");

const CashPaymentLineSchema = new mongoose.Schema({
  accountCode: {
    type: String,
    required: true,
    trim: true,
  },
  accountName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
});

const CashPaymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    serialNo: {
      type: String,
      trim: true,
    },
    cancel: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Date,
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    jobDescription: {
      type: String,
      trim: true,
    },
    employeeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentLines: [CashPaymentLineSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster tenant-scoped queries
CashPaymentSchema.index({ tenantId: 1, project: 1 });

// Generate serial number before validation
CashPaymentSchema.pre("validate", async function () {
  // Only generate for new documents without a serial number
  if (this.isNew && !this.serialNo) {
    try {
      const count = await mongoose.model("CashPayment").countDocuments();
      this.serialNo = `CP${String(count + 1).padStart(6, "0")}`;
      console.log("Generated serial number:", this.serialNo);
    } catch (error) {
      console.error("Error generating serial number:", error);
      throw error;
    }
  }
});

// Track if document is new for post-save hook
CashPaymentSchema.pre("save", function () {
  this.wasNew = this.isNew;
});

// Post-save middleware to create journal entry for accounting
CashPaymentSchema.post("save", async function (doc) {
  // Only create journal entry if this is a new payment (not an update)
  if (this.wasNew && !doc.cancel) {
    try {
      const AccountingService = require("../services/accountingService");

      // Use the createdBy field as the userId
      const userId = doc.createdBy;

      if (userId) {
        await AccountingService.createCashPaymentJournalEntry(doc, userId);
      }
    } catch (error) {
      console.error(
        "Error creating journal entry for cash payment:",
        error.message
      );
      if (doc.$session && doc.$session()) {
        throw error;
      }
    }
  }
});
// Indexes for tenant isolation and queries
CashPaymentSchema.index({ tenantId: 1 });
CashPaymentSchema.index({ tenantId: 1, serialNo: 1 });
CashPaymentSchema.index({ tenantId: 1, date: -1 });
CashPaymentSchema.index({ tenantId: 1, createdAt: -1 });
CashPaymentSchema.index({ tenantId: 1, updatedAt: -1 });
const CashPayment = mongoose.model("CashPayment", CashPaymentSchema);

module.exports = CashPayment;
