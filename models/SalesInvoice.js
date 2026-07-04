const mongoose = require("mongoose");

const salesInvoiceItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ["Inventory", "Plot"],
    default: "Inventory",
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "items.itemType",
  },
  plot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plot",
  },
  itemCode: {
    type: String,
    required: [true, "Item code is required"],
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
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
  grossAmount: {
    type: Number,
    default: 0,
    min: [0, "Gross amount cannot be negative"],
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: [0, "Discount percent cannot be negative"],
    max: [100, "Discount percent cannot exceed 100"],
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
});

const salesInvoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    // Top Fields
    serialNo: {
      type: String,
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      required: [true, "Invoice date is required"],
      default: Date.now,
    },
    purchaseOrderNo: {
      type: String,
      trim: true,
    },
    deliveryChallanNo: {
      type: String,
      trim: true,
    },
    termsOfPayment: {
      type: String,
      enum: ["Cash", "Credit", "Cheque", "Bank Transfer"],
      default: "Cash",
    },
    incomeAccount: {
      type: String,
      trim: true,
    },

    // Customer Details
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },
    customerCode: {
      type: String,
      required: [true, "Customer code is required"],
      trim: true,
      uppercase: true,
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    telephone: {
      type: String,
      trim: true,
    },

    // Items Array
    items: {
      type: [salesInvoiceItemSchema],
      required: [true, "At least one item is required"],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Invoice must have at least one item",
      },
    },

    // Job/Project Information
    inventoryLocation: {
      type: String,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    jobNo: {
      type: String,
      trim: true,
    },
    jobDescription: {
      type: String,
      trim: true,
    },
    employeeReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: {
      type: String,
      trim: true,
    },

    // Financial Calculations
    additionalDiscount: {
      type: Number,
      default: 0,
      min: [0, "Additional discount cannot be negative"],
    },
    carriageFreight: {
      type: Number,
      default: 0,
      min: [0, "Carriage freight cannot be negative"],
    },
    netTotal: {
      type: Number,
      default: 0,
      min: [0, "Net total cannot be negative"],
    },
    amountReceived: {
      type: Number,
      default: 0,
      min: [0, "Amount received cannot be negative"],
    },
    balance: {
      type: Number,
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "partial", "paid", "cancelled"],
      default: "pending",
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

// Indexes for better query performance
salesInvoiceSchema.index({ tenantId: 1, date: -1 });
salesInvoiceSchema.index({ tenantId: 1, customer: 1 });
salesInvoiceSchema.index({ tenantId: 1, project: 1 });
salesInvoiceSchema.index({ tenantId: 1, status: 1 });
salesInvoiceSchema.index({ tenantId: 1, customer: 1, date: -1 });
salesInvoiceSchema.index({ tenantId: 1, project: 1, date: -1 });
salesInvoiceSchema.index({ tenantId: 1, "items.itemCode": 1 });
salesInvoiceSchema.index({ tenantId: 1, createdAt: -1 });
salesInvoiceSchema.index({ tenantId: 1, updatedAt: -1 });

// Pre-save middleware to calculate amounts, generate serial number, and track if document is new
salesInvoiceSchema.pre("save", async function (next) {
  // Track if document is new (for post-save hook)
  this.wasNew = this.isNew;

  // Generate random serial number if not provided
  if (!this.serialNo) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      this.serialNo = `SI-${randomNum}`;

      const existing = await mongoose
        .model("SalesInvoice")
        .findOne({ serialNo: this.serialNo });

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error("Failed to generate unique serial number");
    }
  }

  // Calculate item amounts
  this.items.forEach((item) => {
    // Calculate gross amount
    item.grossAmount = item.quantity * item.rate;

    // Calculate discount
    if (item.discountPercent > 0) {
      item.discount = (item.grossAmount * item.discountPercent) / 100;
    }

    // Calculate net amount
    item.netAmount = item.grossAmount - item.discount;
  });

  // Calculate net total
  const itemsTotal = this.items.reduce((sum, item) => sum + item.netAmount, 0);
  this.netTotal = itemsTotal - this.additionalDiscount + this.carriageFreight;

  // Calculate balance
  this.balance = this.netTotal - this.amountReceived;

  // Update status based on payment
  if (this.amountReceived === 0) {
    this.status = "pending";
  } else if (this.amountReceived >= this.netTotal) {
    this.status = "paid";
    this.balance = 0;
  } else {
    this.status = "partial";
  }
});

// Post-save middleware to create journal entry for accounting
salesInvoiceSchema.post("save", async function (doc) {
  // Only create journal entry if this is a new invoice (not an update)
  if (this.wasNew && doc.status !== "cancelled") {
    try {
      const AccountingService = require("../services/accountingService");

      // Get the user who created the invoice (default to first admin if not available)
      let userId = doc.createdBy;
      if (!userId) {
        const User = require("./User");
        const admin = await User.findOne({ role: "admin" });
        userId = admin ? admin._id : null;
      }

      if (userId) {
        // Check if this invoice contains plots
        const hasPlots = doc.items.some((item) => item.itemType === "Plot");

        if (hasPlots) {
          // Create plot sales invoice journal entry
          await AccountingService.createPlotSalesInvoiceJournalEntry(
            doc,
            userId
          );
        } else {
          // Create regular sales journal entry
          await AccountingService.createSalesJournalEntry(doc, userId);
        }
      }
    } catch (error) {
      console.error(
        "Error creating journal entry for sales invoice:",
        error.message
      );
      if (doc.$session && doc.$session()) {
        throw error;
      }
    }
  }
});

// Indexes for tenant isolation and queries
salesInvoiceSchema.index({ tenantId: 1 });
salesInvoiceSchema.index({ tenantId: 1, serialNo: 1 });

module.exports = mongoose.model("SalesInvoice", salesInvoiceSchema);
