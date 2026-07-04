const GeneralLedger = require("../models/GeneralLedger");
const AccountingService = require("../services/accountingService");

// @desc    Get general ledger entries
// @route   GET /api/general-ledger
// @access  Private
const getGeneralLedger = async (req, res) => {
  try {
    const queryParams = req.sanitizedQuery || req.query;
    const { accountCode, startDate, endDate, accountType, project } =
      queryParams;

    // Build query
    const query = { tenantId: req.tenantId, status: "Active" };
    if (accountCode) query.accountCode = accountCode;
    if (accountType) query.accountType = accountType;
    if (project) query.project = project;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const entries = await GeneralLedger.find(query)
      .sort({ date: 1, createdAt: 1 })
      .populate("journalEntry", "entryNumber description")
      .populate("project", "name code")
      .populate("account", "code name");

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    console.error("Error fetching general ledger:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching general ledger",
      error: error.message,
    });
  }
};

// @desc    Get account ledger with running balance
// @route   GET /api/general-ledger/account/:accountCode
// @access  Private
const getAccountLedger = async (req, res) => {
  try {
    const { accountCode } = req.params;
    const queryParams = req.sanitizedQuery || req.query;
    const { startDate, endDate } = queryParams;

    const ledger = await AccountingService.getAccountLedger(
      accountCode,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data: ledger,
    });
  } catch (error) {
    console.error("Error fetching account ledger:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching account ledger",
      error: error.message,
    });
  }
};

// @desc    Get account balance
// @route   GET /api/general-ledger/balance/:accountCode
// @access  Private
const getAccountBalance = async (req, res) => {
  try {
    const { accountCode } = req.params;
    const queryParams = req.sanitizedQuery || req.query;
    const { asOfDate } = queryParams;

    const balance = await AccountingService.getAccountBalance(
      accountCode,
      asOfDate ? new Date(asOfDate) : new Date()
    );

    res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    console.error("Error fetching account balance:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching account balance",
      error: error.message,
    });
  }
};

// @desc    Get trial balance
// @route   GET /api/general-ledger/trial-balance
// @access  Private
const getTrialBalance = async (req, res) => {
  try {
    const queryParams = req.sanitizedQuery || req.query;
    const { asOfDate } = queryParams;

    const trialBalance = await AccountingService.getTrialBalance(
      asOfDate ? new Date(asOfDate) : new Date()
    );

    res.status(200).json({
      success: true,
      data: trialBalance,
    });
  } catch (error) {
    console.error("Error fetching trial balance:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching trial balance",
      error: error.message,
    });
  }
};

// @desc    Get balance sheet
// @route   GET /api/general-ledger/balance-sheet
// @access  Private
const getBalanceSheet = async (req, res) => {
  try {
    const { asOfDate } = req.query;

    const balanceSheet = await AccountingService.getBalanceSheet(
      asOfDate ? new Date(asOfDate) : new Date()
    );

    res.status(200).json({
      success: true,
      data: balanceSheet,
    });
  } catch (error) {
    console.error("Error fetching balance sheet:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching balance sheet",
      error: error.message,
    });
  }
};

// @desc    Get profit & loss statement
// @route   GET /api/general-ledger/profit-loss
// @access  Private
const getProfitAndLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const profitAndLoss = await AccountingService.getProfitAndLoss(
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : new Date()
    );

    res.status(200).json({
      success: true,
      data: profitAndLoss,
    });
  } catch (error) {
    console.error("Error fetching profit & loss:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profit & loss statement",
      error: error.message,
    });
  }
};

// @desc    Get ledger summary by account type
// @route   GET /api/general-ledger/summary
// @access  Private
const getLedgerSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { tenantId: req.tenantId, status: "Active" };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const summary = await GeneralLedger.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$accountType",
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          accountType: "$_id",
          totalDebit: 1,
          totalCredit: 1,
          balance: { $subtract: ["$totalDebit", "$totalCredit"] },
          transactionCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching ledger summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching ledger summary",
      error: error.message,
    });
  }
};

module.exports = {
  getGeneralLedger,
  getAccountLedger,
  getAccountBalance,
  getTrialBalance,
  getBalanceSheet,
  getProfitAndLoss,
  getLedgerSummary,
};
