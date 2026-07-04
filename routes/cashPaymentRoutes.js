const express = require("express");
const router = express.Router();
const {
  getAllCashPayments,
  getCashPaymentById,
  createCashPayment,
  updateCashPayment,
  deleteCashPayment,
  getCashPaymentsByProject,
  getCashPaymentsByDateRange,
  getExpenseAccounts,
} = require("../controllers/cashPaymentController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const CashPayment = require("../models/CashPayment");
const PERMISSIONS = require("../constants/permissions");

// All routes require authentication
router.use(protect);
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.CASH_PAYMENT));

// Specific routes must come BEFORE parameterized routes
router.route("/expense-accounts").get(getExpenseAccounts);

// Main routes
router.route("/")
  .get(getAllCashPayments)
  .post(approvalInterceptor("create_cash_payment"), createCashPayment);

// Date range route
router.route("/daterange").get(getCashPaymentsByDateRange);

// Project-specific route
router.route("/project/:projectId").get(getCashPaymentsByProject);

// Individual payment routes
router
  .route("/:id")
  .get(getCashPaymentById)
  .put(approvalInterceptor("edit_cash_payment", { model: CashPayment }), updateCashPayment)
  .delete(approvalInterceptor("delete_cash_payment", { model: CashPayment }), deleteCashPayment);

module.exports = router;
