const mongoose = require("mongoose");

// Schema for General Ledger entries
const GeneralLedgerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
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
    date: {
      type: Date,
      required: true,
    },
    journalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      required: true,
    },
    entryNumber: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
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
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
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
    // Running balance for the account
    balance: {
      type: Number,
      default: 0,
    },
    // Reference to source transaction
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
    fiscalYear: {
      type: Number,
      required: false, // Auto-generated in pre-save hook
    },
    fiscalPeriod: {
      type: Number,
      required: false, // Auto-generated in pre-save hook
      min: 1,
      max: 12,
    },
    status: {
      type: String,
      enum: ["Active", "Reversed", "Cancelled"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performance
GeneralLedgerSchema.index({ tenantId: 1, accountCode: 1, date: 1 });
GeneralLedgerSchema.index({ tenantId: 1, accountType: 1, date: 1 });
GeneralLedgerSchema.index({ tenantId: 1, project: 1, date: 1 });
GeneralLedgerSchema.index({ tenantId: 1, fiscalYear: 1, fiscalPeriod: 1 });
GeneralLedgerSchema.index({ tenantId: 1, date: -1 });
GeneralLedgerSchema.index({ tenantId: 1, journalEntry: 1 });

// Pre-save middleware to set fiscal year and period
GeneralLedgerSchema.pre("save", function () {
  const date = new Date(this.date);
  this.fiscalYear = date.getFullYear();
  this.fiscalPeriod = date.getMonth() + 1;
});

// Static method to get account balance at a specific date
GeneralLedgerSchema.statics.getAccountBalance = async function (
  accountCode,
  asOfDate = new Date(),
  tenantId = null
) {
  const match = {
    accountCode: accountCode,
    date: { $lte: new Date(asOfDate) },
    status: "Active",
  };
  if (tenantId) match.tenantId = tenantId;

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$accountCode",
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
        accountName: { $first: "$accountName" },
        accountType: { $first: "$accountType" },
      },
    },
    {
      $project: {
        accountCode: "$_id",
        accountName: 1,
        accountType: 1,
        totalDebit: 1,
        totalCredit: 1,
        balance: { $subtract: ["$totalDebit", "$totalCredit"] },
      },
    },
  ]);

  return result.length > 0
    ? result[0]
    : { balance: 0, totalDebit: 0, totalCredit: 0 };
};

// Static method to get account ledger with running balance
GeneralLedgerSchema.statics.getAccountLedger = async function (
  accountCode,
  startDate,
  endDate,
  tenantId = null
) {
  const query = {
    accountCode: accountCode,
    status: "Active",
  };
  if (tenantId) query.tenantId = tenantId;

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // Get opening balance (transactions before start date)
  let openingBalance = 0;
  if (startDate) {
    const opening = await this.getAccountBalance(
      accountCode,
      new Date(startDate),
      tenantId
    );
    openingBalance = opening.balance || 0;
  }

  // Get ledger entries
  const entries = await this.find(query)
    .sort({ date: 1, createdAt: 1 })
    .populate("journalEntry", "entryNumber description")
    .populate("project", "name code");

  // Calculate running balance
  let runningBalance = openingBalance;
  const ledgerWithBalance = entries.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return {
      ...entry.toObject(),
      runningBalance: runningBalance,
    };
  });

  return {
    accountCode,
    openingBalance,
    closingBalance: runningBalance,
    entries: ledgerWithBalance,
  };
};

// Static method to get trial balance
GeneralLedgerSchema.statics.getTrialBalance = async function (
  asOfDate = new Date(),
  tenantId = null
) {
  const match = {
    date: { $lte: new Date(asOfDate) },
    status: "Active",
  };
  if (tenantId) match.tenantId = tenantId;

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$accountCode",
        accountName: { $first: "$accountName" },
        accountType: { $first: "$accountType" },
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
      },
    },
    {
      $project: {
        accountCode: "$_id",
        accountName: 1,
        accountType: 1,
        debit: { $subtract: ["$totalDebit", "$totalCredit"] },
        credit: { $subtract: ["$totalCredit", "$totalDebit"] },
      },
    },
    {
      $match: {
        $or: [{ debit: { $gt: 0 } }, { credit: { $gt: 0 } }],
      },
    },
    {
      $sort: { accountCode: 1 },
    },
  ]);

  // Separate into debit and credit balances
  const trialBalance = result.map((account) => ({
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountType: account.accountType,
    debit: account.debit > 0 ? account.debit : 0,
    credit: account.credit > 0 ? account.credit : 0,
  }));

  // Calculate totals
  const totals = trialBalance.reduce(
    (acc, account) => {
      acc.totalDebit += account.debit;
      acc.totalCredit += account.credit;
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 }
  );

  return {
    asOfDate: asOfDate,
    accounts: trialBalance,
    totalDebit: totals.totalDebit,
    totalCredit: totals.totalCredit,
    isBalanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01,
  };
};

// Static method to get balance sheet data
GeneralLedgerSchema.statics.getBalanceSheet = async function (
  asOfDate = new Date(),
  tenantId = null
) {
  const match = {
    date: { $lte: new Date(asOfDate) },
    status: "Active",
    accountType: { $in: ["Asset", "Liability", "Equity"] },
  };
  if (tenantId) match.tenantId = tenantId;

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          accountCode: "$accountCode",
          accountType: "$accountType",
        },
        accountName: { $first: "$accountName" },
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
      },
    },
    {
      $project: {
        accountCode: "$_id.accountCode",
        accountName: 1,
        accountType: "$_id.accountType",
        balance: { $subtract: ["$totalDebit", "$totalCredit"] },
      },
    },
    {
      $sort: { accountCode: 1 },
    },
  ]);

  // Organize by account type
  const assets = result.filter(
    (a) => a.accountType === "Asset" && a.balance !== 0
  );
  const liabilities = result.filter(
    (a) => a.accountType === "Liability" && a.balance !== 0
  );
  const equity = result.filter(
    (a) => a.accountType === "Equity" && a.balance !== 0
  );

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce(
    (sum, a) => sum + Math.abs(a.balance),
    0
  );
  const totalEquity = equity.reduce((sum, a) => sum + Math.abs(a.balance), 0);

  return {
    asOfDate: asOfDate,
    assets: {
      accounts: assets,
      total: totalAssets,
    },
    liabilities: {
      accounts: liabilities.map((l) => ({
        ...l,
        balance: Math.abs(l.balance),
      })),
      total: totalLiabilities,
    },
    equity: {
      accounts: equity.map((e) => ({ ...e, balance: Math.abs(e.balance) })),
      total: totalEquity,
    },
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
};

// Static method to get profit & loss statement
GeneralLedgerSchema.statics.getProfitAndLoss = async function (
  startDate,
  endDate,
  tenantId = null
) {
  const query = {
    status: "Active",
    accountType: { $in: ["Revenue", "Expense"] },
  };
  if (tenantId) query.tenantId = tenantId;

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          accountCode: "$accountCode",
          accountType: "$accountType",
        },
        accountName: { $first: "$accountName" },
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
      },
    },
    {
      $project: {
        accountCode: "$_id.accountCode",
        accountName: 1,
        accountType: "$_id.accountType",
        balance: { $subtract: ["$totalDebit", "$totalCredit"] },
      },
    },
    {
      $sort: { accountCode: 1 },
    },
  ]);

  // Separate revenue and expenses
  const revenue = result.filter((a) => a.accountType === "Revenue");
  const expenses = result.filter((a) => a.accountType === "Expense");

  // Revenue is typically credit balance, so we negate for display
  const totalRevenue = revenue.reduce((sum, a) => sum + Math.abs(a.balance), 0);
  // Expenses are typically debit balance
  const totalExpenses = expenses.reduce(
    (sum, a) => sum + Math.abs(a.balance),
    0
  );
  const netProfit = totalRevenue - totalExpenses;

  return {
    period: {
      startDate: startDate || "Beginning",
      endDate: endDate || "Present",
    },
    revenue: {
      accounts: revenue.map((r) => ({ ...r, amount: Math.abs(r.balance) })),
      total: totalRevenue,
    },
    expenses: {
      accounts: expenses.map((e) => ({ ...e, amount: Math.abs(e.balance) })),
      total: totalExpenses,
    },
    netProfit: netProfit,
    netProfitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
  };
};

// Indexes for efficient multi-tenant queries
GeneralLedgerSchema.index({ tenantId: 1, accountCode: 1 });

const GeneralLedger = mongoose.model("GeneralLedger", GeneralLedgerSchema);

module.exports = GeneralLedger;
