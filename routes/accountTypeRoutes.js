const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getAllAccountTypes,
  getAccountTypeById,
  createAccountType,
  updateAccountType,
  deleteAccountType,
} = require("../controllers/accountTypeController");

// @route   GET /api/account-types
// @desc    Get all account types
// @access  Private
router.get("/", protect, getAllAccountTypes);

// @route   GET /api/account-types/:id
// @desc    Get single account type
// @access  Private
router.get("/:id", protect, getAccountTypeById);

// @route   POST /api/account-types
// @desc    Create new account type
// @access  Private
router.post("/", protect, createAccountType);

// @route   PUT /api/account-types/:id
// @desc    Update account type
// @access  Private
router.put("/:id", protect, updateAccountType);

// @route   DELETE /api/account-types/:id
// @desc    Delete account type
// @access  Private
router.delete("/:id", protect, deleteAccountType);

module.exports = router;
