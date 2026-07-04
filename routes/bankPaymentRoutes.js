const express = require("express");
const router = express.Router();
const {
  getBankPayments,
  getBankPaymentById,
  createBankPayment,
  updateBankPayment,
  deleteBankPayment,
  getBankEnum,
  getExpenseAccounts,
  generateSerialNumber,
} = require("../controllers/bankPaymentController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const BankPayment = require("../models/BankPayment");
const PERMISSIONS = require("../constants/permissions");

// All routes are protected and permission-scoped
router.use(protect);
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.BANK_PAYMENT));

// Specific routes must come BEFORE parameterized routes
router.get("/enums/banks", getBankEnum);
router.get("/expense-accounts", getExpenseAccounts);
router.get("/generate-serial", generateSerialNumber);

// CRUD operations
router
  .route("/")
  .get(getBankPayments)
  .post(approvalInterceptor("create_bank_payment"), createBankPayment);

router
  .route("/:id")
  .get(getBankPaymentById)
  .put(approvalInterceptor("edit_bank_payment", { model: BankPayment }), updateBankPayment)
  .delete(approvalInterceptor("delete_bank_payment", { model: BankPayment }), deleteBankPayment);

module.exports = router;
