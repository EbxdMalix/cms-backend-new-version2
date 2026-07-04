const ChartOfAccount = require("../models/ChartOfAccount");

// @desc    Get all chart of accounts
// @route   GET /api/chartofaccounts
// @access  Private
const getChartOfAccounts = async (req, res) => {
  try {
    // Filter by tenantId - only show data for current tenant
    const accounts = await ChartOfAccount.find({ tenantId: req.tenantId })
      .populate("createdBy", "name email")
      .populate("mainAccountType", "name code financialComponent")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get single chart of account by ID
// @route   GET /api/chartofaccounts/:id
// @access  Private
const getChartOfAccountById = async (req, res) => {
  try {
    // Filter by both ID and tenantId for security
    const account = await ChartOfAccount.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate("createdBy", "name email")
      .populate("mainAccountType", "name code financialComponent");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Chart of Account not found",
      });
    }

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    console.error("Error fetching chart of account:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Create new chart of account
// @route   POST /api/chartofaccounts
// @access  Private
const createChartOfAccount = async (req, res) => {
  try {
    const {
      mainAccountType,
      mainTypeCode,
      mainAccountTypeText,
      financialComponent,
      subAccounts,
      listAccounts,
    } = req.body;

    // Validate required fields
    if (
      !mainAccountType ||
      !mainTypeCode ||
      !mainAccountTypeText ||
      !financialComponent
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check for duplicate main type code - only within same tenant
    const existingAccount = await ChartOfAccount.findOne({
      tenantId: req.tenantId,
      mainTypeCode,
    });
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "Account with this main type code already exists",
      });
    }

    const account = await ChartOfAccount.create({
      tenantId: req.tenantId, // Automatically add tenantId
      mainAccountType,
      mainTypeCode,
      mainAccountTypeText,
      financialComponent,
      subAccounts: subAccounts || [],
      listAccounts: listAccounts || [],
      createdBy: req.user._id,
    });

    // Populate the mainAccountType reference before sending response
    await account.populate("mainAccountType", "name code financialComponent");

    res.status(201).json({
      success: true,
      message: "Chart of Account created successfully",
      data: account,
    });
  } catch (error) {
    console.error("Error creating chart of account:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Update chart of account
// @route   PUT /api/chartofaccounts/:id
// @access  Private
const updateChartOfAccount = async (req, res) => {
  try {
    const {
      mainAccountType,
      mainTypeCode,
      mainAccountTypeText,
      financialComponent,
      subAccounts,
      listAccounts,
    } = req.body;

    let account = await ChartOfAccount.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Chart of Account not found",
      });
    }

    // Check if updating main type code and if it's already taken - within same tenant
    if (mainTypeCode && mainTypeCode !== account.mainTypeCode) {
      const duplicate = await ChartOfAccount.findOne({
        tenantId: req.tenantId,
        mainTypeCode,
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Account with this main type code already exists",
        });
      }
    }

    // Update fields
    account.mainAccountType = mainAccountType || account.mainAccountType;
    account.mainTypeCode = mainTypeCode || account.mainTypeCode;
    account.mainAccountTypeText =
      mainAccountTypeText || account.mainAccountTypeText;
    account.financialComponent =
      financialComponent || account.financialComponent;
    account.subAccounts =
      subAccounts !== undefined ? subAccounts : account.subAccounts;
    account.listAccounts =
      listAccounts !== undefined ? listAccounts : account.listAccounts;

    await account.save();

    res.status(200).json({
      success: true,
      message: "Chart of Account updated successfully",
      data: account,
    });
  } catch (error) {
    console.error("Error updating chart of account:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Delete chart of account
// @route   DELETE /api/chartofaccounts/:id
// @access  Private
const deleteChartOfAccount = async (req, res) => {
  try {
    const account = await ChartOfAccount.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Chart of Account not found",
      });
    }

    await account.deleteOne();

    res.status(200).json({
      success: true,
      message: "Chart of Account deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("Error deleting chart of account:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get account types enum
// @route   GET /api/chartofaccounts/enums/types
// @access  Private
const getAccountTypesEnum = async (req, res) => {
  try {
    const accountTypes = [
      {
        value: "Administrative Expenses",
        code: "ADM",
        type: "Administrative Expenses",
        component: "Operating Expenses",
      },
      {
        value: "Marketing & Distribution Expenses",
        code: "MKT",
        type: "Marketing & Distribution Expenses",
        component: "Operating Expenses",
      },
      {
        value: "Financial Expenses",
        code: "FIN",
        type: "Financial Expenses",
        component: "Operating Expenses",
      },
      {
        value: "Taxation",
        code: "TAX",
        type: "Taxation",
        component: "Operating Expenses",
      },
      {
        value: "Other Operating Income",
        code: "OOI",
        type: "Other Operating Income",
        component: "Operating Income",
      },
      {
        value: "Other Expenses",
        code: "OEX",
        type: "Other Expenses",
        component: "Operating Expenses",
      },
      {
        value: "Labour Wages",
        code: "LAB",
        type: "Labour Wages",
        component: "Direct Costs",
      },
      {
        value: "Vehicle Expense",
        code: "VEH",
        type: "Vehicle Expense",
        component: "Operating Expenses",
      },
    ];

    res.status(200).json({
      success: true,
      data: accountTypes,
    });
  } catch (error) {
    console.error("Error fetching account types:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getChartOfAccounts,
  getChartOfAccountById,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  getAccountTypesEnum,
};
