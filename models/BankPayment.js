const mongoose = require("mongoose");

const PaymentLineSchema = new mongoose.Schema({
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

const BankPaymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    serialNo: {
      type: String,
      required: true,
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
    bankAccount: {
      type: String,
      required: true,
      enum: [
        "Meezan Bank",
        "HBL",
        "Allied Bank",
        "UBL",
        "MCB",
        "Standard Chartered",
        "Faysal Bank",
        "Bank Alfalah",
        "Al Makramah Bank",
      ],
    },
    bankAccountNumber: {
      type: String,
      trim: true,
    },
    chequeNo: {
      type: String,
      trim: true,
    },
    chequeDate: {
      type: Date,
    },
    paymentLines: [PaymentLineSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
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
BankPaymentSchema.index({ tenantId: 1, project: 1 });
BankPaymentSchema.index({ tenantId: 1, bankAccount: 1 });

// Generate serial number before saving and track if document is new
BankPaymentSchema.pre("save", async function () {
  // Track if document is new (for post-save hook)
  this.wasNew = this.isNew;

  if (!this.serialNo || this.serialNo === "") {
    const count = await mongoose.model("BankPayment").countDocuments();
    this.serialNo = `BP${String(count + 1).padStart(6, "0")}`;
  }
});

// Post-save middleware to create journal entry for accounting
BankPaymentSchema.post("save", async function (doc) {
  // Only create journal entry if this is a new payment (not an update)
  if (this.wasNew && !doc.cancel) {
    try {
      const AccountingService = require("../services/accountingService");

      // Use the createdBy field as the userId
      const userId = doc.createdBy;

      if (userId) {
        await AccountingService.createBankPaymentJournalEntry(doc, userId);
      }
    } catch (error) {
      console.error(
        "Error creating journal entry for bank payment:",
        error.message
      );
      if (doc.$session && doc.$session()) {
        throw error;
      }
    }
  }
});
// Indexes for tenant isolation and queries
BankPaymentSchema.index({ tenantId: 1 });
BankPaymentSchema.index({ tenantId: 1, serialNo: 1 });
BankPaymentSchema.index({ tenantId: 1, date: -1 });
BankPaymentSchema.index({ tenantId: 1, createdAt: -1 });
BankPaymentSchema.index({ tenantId: 1, updatedAt: -1 });
const BankPayment = mongoose.model("BankPayment", BankPaymentSchema);

module.exports = BankPayment;
