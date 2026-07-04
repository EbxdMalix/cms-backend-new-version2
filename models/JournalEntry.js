const mongoose = require("mongoose");

// Schema for individual journal entry lines (debit/credit)
const JournalEntryLineSchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChartOfAccount",
    required: true,
  },
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
  accountType: {
    type: String,
    required: true,
    enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"],
  },
  debit: {
    type: Number,
    default: 0,
    min: [0, "Debit cannot be negative"],
  },
  credit: {
    type: Number,
    default: 0,
    min: [0, "Credit cannot be negative"],
  },
  description: {
    type: String,
    trim: true,
  },
});

// Main Journal Entry Schema
const JournalEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    entryNumber: {
      type: String,
      required: false, // Auto-generated in pre-save hook
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    transactionType: {
      type: String,
      required: true,
      enum: [
        "Sale",
        "Purchase",
        "Payment",
        "Receipt",
        "Journal",
        "Opening Balance",
        "Adjustment",
        "Booking",
      ],
    },
    // Reference to the source transaction
    sourceTransaction: {
      model: {
        type: String,
        enum: [
          "SalesInvoice",
          "Purchase",
          "BankPayment",
          "CashPayment",
          "Plot",
          "Manual",
        ],
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "sourceTransaction.model",
      },
      reference: {
        type: String,
        trim: true,
      },
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Journal entry lines (debits and credits)
    lines: {
      type: [JournalEntryLineSchema],
      required: true,
      validate: {
        validator: function (lines) {
          return lines && lines.length >= 2;
        },
        message: "A journal entry must have at least 2 lines",
      },
    },
    // Auto-calculated totals
    totalDebit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCredit: {
      type: Number,
      required: true,
      min: 0,
    },
    // Status
    status: {
      type: String,
      enum: ["Draft", "Posted", "Reversed", "Cancelled"],
      default: "Posted",
    },
    isPosted: {
      type: Boolean,
      default: true,
    },
    postedAt: {
      type: Date,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
    },
    // Notes and attachments
    notes: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
JournalEntrySchema.index({ tenantId: 1, date: -1 });
// entryNumber already has unique index from schema definition
JournalEntrySchema.index({ tenantId: 1, transactionType: 1, date: -1 });
JournalEntrySchema.index({ tenantId: 1, project: 1, date: -1 });
JournalEntrySchema.index({
  tenantId: 1,
  "sourceTransaction.model": 1,
  "sourceTransaction.id": 1,
});
JournalEntrySchema.index({ tenantId: 1, status: 1 });
JournalEntrySchema.index({ tenantId: 1, "lines.accountCode": 1 });

// Pre-save validation: ensure debits equal credits
JournalEntrySchema.pre("save", function (next) {
  // Calculate totals
  this.totalDebit = this.lines.reduce(
    (sum, line) => sum + (line.debit || 0),
    0
  );
  this.totalCredit = this.lines.reduce(
    (sum, line) => sum + (line.credit || 0),
    0
  );

  // Validate double-entry bookkeeping rule
  const difference = Math.abs(this.totalDebit - this.totalCredit);
  if (difference > 0.01) {
    // Allow for small rounding errors
    throw new Error(
      `Journal entry is not balanced. Debits (${this.totalDebit}) must equal Credits (${this.totalCredit})`
    );
  }

  // Validate that each line has either debit or credit, not both
  for (const line of this.lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(
        `Line for account ${line.accountName} cannot have both debit and credit`
      );
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new Error(
        `Line for account ${line.accountName} must have either debit or credit`
      );
    }
  }

  // Set posted timestamp if posting
  if (this.isPosted && this.status === "Posted" && !this.postedAt) {
    this.postedAt = new Date();
  }
});

// Generate entry number before saving
JournalEntrySchema.pre("save", async function () {
  if (!this.entryNumber || this.entryNumber === "") {
    const year = new Date(this.date).getFullYear();
    const count = await mongoose
      .model("JournalEntry")
      .countDocuments({ date: { $gte: new Date(year, 0, 1) } });
    this.entryNumber = `JE-${year}-${String(count + 1).padStart(6, "0")}`;
  }
});

// Method to reverse a journal entry
JournalEntrySchema.methods.reverse = async function (userId, reason) {
  if (this.status !== "Posted") {
    throw new Error("Only posted journal entries can be reversed");
  }

  // Create reversal entry
  const reversalLines = this.lines.map((line) => ({
    account: line.account,
    accountCode: line.accountCode,
    accountName: line.accountName,
    accountType: line.accountType,
    debit: line.credit, // Swap debit and credit
    credit: line.debit,
    description: `Reversal of ${line.description}`,
  }));

  const JournalEntry = mongoose.model("JournalEntry");
  const reversalEntry = await JournalEntry.create({
    date: new Date(),
    transactionType: "Adjustment",
    sourceTransaction: {
      model: "Manual",
      reference: `Reversal of ${this.entryNumber}`,
    },
    project: this.project,
    description: `Reversal: ${reason || this.description}`,
    lines: reversalLines,
    status: "Posted",
    isPosted: true,
    reversalOf: this._id,
    createdBy: userId,
  });

  // Mark original as reversed
  this.status = "Reversed";
  this.reversedBy = reversalEntry._id;
  await this.save();

  return reversalEntry;
};

// Static method to get entries by account
JournalEntrySchema.statics.getByAccount = function (
  accountCode,
  startDate,
  endDate
) {
  const query = {
    status: "Posted",
    "lines.accountCode": accountCode,
  };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  return this.find(query).sort({ date: 1 }).populate("createdBy", "name email");
};

// Indexes for tenant isolation and queries
JournalEntrySchema.index({ tenantId: 1 });
JournalEntrySchema.index({ tenantId: 1, entryNumber: 1 });
JournalEntrySchema.index({ tenantId: 1, createdAt: -1 });
JournalEntrySchema.index({ tenantId: 1, updatedAt: -1 });

const JournalEntry = mongoose.model("JournalEntry", JournalEntrySchema);

module.exports = JournalEntry;
