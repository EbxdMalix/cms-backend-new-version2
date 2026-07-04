const AccountType = require("../models/AccountType");

// @desc    Get all account types
// @route   GET /api/account-types
// @access  Private
const getAllAccountTypes = async (req, res) => {
  try {
    const accountTypes = await AccountType.find({
      tenantId: req.tenantId,
      isActive: true,
    })
      .sort({ name: 1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      count: accountTypes.length,
      data: accountTypes,
    });
  } catch (error) {
    console.error("Get all account types error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching account types",
      error: error.message,
    });
  }
};

// @desc    Get single account type by ID
// @route   GET /api/account-types/:id
// @access  Private
const getAccountTypeById = async (req, res) => {
  try {
    const accountType = await AccountType.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).populate("createdBy", "name email");

    if (!accountType) {
      return res.status(404).json({
        success: false,
        message: "Account type not found",
      });
    }

    res.status(200).json({
      success: true,
      data: accountType,
    });
  } catch (error) {
    console.error("Get account type by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching account type",
      error: error.message,
    });
  }
};

// @desc    Create new account type
// @route   POST /api/account-types
// @access  Private
const createAccountType = async (req, res) => {
  try {
    const { name, code, financialComponent, description } = req.body;

    // Validation
    if (!name || !code || !financialComponent) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, code, and financial component",
      });
    }

    // Check if account type already exists
    const existingAccountType = await AccountType.findOne({
      tenantId: req.tenantId,
      $or: [{ name }, { code: code.toUpperCase() }],
    });

    if (existingAccountType) {
      return res.status(400).json({
        success: false,
        message: "Account type with this name or code already exists",
      });
    }

    // Create account type
    const accountType = await AccountType.create({
      tenantId: req.tenantId,
      name,
      code: code.toUpperCase(),
      financialComponent,
      description: description || "",
      createdBy: req.user._id,
    });

    await accountType.populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Account type created successfully",
      data: accountType,
    });
  } catch (error) {
    console.error("Create account type error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Account type with this name or code already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating account type",
      error: error.message,
    });
  }
};

// @desc    Update account type
// @route   PUT /api/account-types/:id
// @access  Private
const updateAccountType = async (req, res) => {
  try {
    const accountType = await AccountType.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!accountType) {
      return res.status(404).json({
        success: false,
        message: "Account type not found",
      });
    }

    const { name, code, financialComponent, description, isActive } = req.body;

    // Check for duplicates if name or code is being changed
    if (name && name !== accountType.name) {
      const existing = await AccountType.findOne({
        tenantId: req.tenantId,
        name,
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Account type with this name already exists",
        });
      }
      accountType.name = name;
    }

    if (code && code.toUpperCase() !== accountType.code) {
      const existing = await AccountType.findOne({
        tenantId: req.tenantId,
        code: code.toUpperCase(),
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Account type with this code already exists",
        });
      }
      accountType.code = code.toUpperCase();
    }

    // Update other fields
    if (financialComponent) accountType.financialComponent = financialComponent;
    if (description !== undefined) accountType.description = description;
    if (typeof isActive === "boolean") accountType.isActive = isActive;

    await accountType.save();
    await accountType.populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Account type updated successfully",
      data: accountType,
    });
  } catch (error) {
    console.error("Update account type error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating account type",
      error: error.message,
    });
  }
};

// @desc    Delete account type
// @route   DELETE /api/account-types/:id
// @access  Private
const deleteAccountType = async (req, res) => {
  try {
    const accountType = await AccountType.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!accountType) {
      return res.status(404).json({
        success: false,
        message: "Account type not found",
      });
    }

    // Soft delete by setting isActive to false
    accountType.isActive = false;
    await accountType.save();

    res.status(200).json({
      success: true,
      message: "Account type deleted successfully",
    });
  } catch (error) {
    console.error("Delete account type error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting account type",
      error: error.message,
    });
  }
};

module.exports = {
  getAllAccountTypes,
  getAccountTypeById,
  createAccountType,
  updateAccountType,
  deleteAccountType,
};
