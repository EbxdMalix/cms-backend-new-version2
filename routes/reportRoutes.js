const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getIncomeStatement,
  getInventoryReport,
  getSupplierLedger,
  getProjectLedger,
  getCustomerLedger,
  getSupplierLedgerV2,
  getInventoryReportV2,
  recordPaymentReceipt,
  recordSupplierPayment,
  getPlotsReport,
} = require("../controllers/reportController");

// All routes are protected and permission-scoped
router.use(protect);
const PERMISSIONS = require("../constants/permissions");
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.REPORTS));

// @route   GET /api/reports/income-statement
// @desc    Get income statement
// @access  Private
router.get("/income-statement", getIncomeStatement);

// @route   GET /api/reports/inventory
// @desc    Get inventory report (Original)
// @access  Private
router.get("/inventory", getInventoryReport);

// @route   GET /api/reports/inventory-v2
// @desc    Get inventory report (Enhanced with AccountingService)
// @access  Private
router.get("/inventory-v2", getInventoryReportV2);

// @route   GET /api/reports/supplier-ledger/:supplierId
// @desc    Get supplier ledger report (Original)
// @access  Private
router.get("/supplier-ledger/:supplierId", getSupplierLedger);

// @route   GET /api/reports/supplier-ledger-v2/:supplierCode
// @desc    Get supplier ledger report (Enhanced with AccountingService)
// @access  Private
router.get("/supplier-ledger-v2/:supplierCode", getSupplierLedgerV2);

// @route   GET /api/reports/project-ledger/:projectId
// @desc    Get project ledger report showing revenues and expenses
// @access  Private
router.get("/project-ledger/:projectId", getProjectLedger);

// @route   GET /api/reports/customer-ledger/:customerId
// @desc    Get customer ledger report showing transactions and balance
// @access  Private
router.get("/customer-ledger/:customerId", getCustomerLedger);

// @route   POST /api/reports/payment-receipt
// @desc    Record customer payment receipt
// @access  Private
router.post("/payment-receipt", recordPaymentReceipt);

// @route   POST /api/reports/supplier-payment
// @desc    Record supplier payment
// @access  Private
router.post("/supplier-payment", recordSupplierPayment);

// @route   GET /api/reports/plots
// @desc    Get plots report with sales, customers, and stock information
// @access  Private
router.get("/plots", getPlotsReport);

module.exports = router;
