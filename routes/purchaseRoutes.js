const express = require("express");
const router = express.Router();
const {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchasesByVendor,
  getPurchasesByDateRange,
} = require("../controllers/purchaseController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const Purchase = require("../models/Purchase");
const PERMISSIONS = require("../constants/permissions");

// All routes are protected
router.use(protect);
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.PURCHASE_ENTRY));

// @route   GET /api/purchases
// @desc    Get all purchases
router.get("/", getAllPurchases);

// @route   GET /api/purchases/vendor/:vendorName
// @desc    Get purchases by vendor
router.get("/vendor/:vendorName", getPurchasesByVendor);

// @route   GET /api/purchases/daterange
// @desc    Get purchases by date range
router.get("/daterange", getPurchasesByDateRange);

// @route   GET /api/purchases/:id
// @desc    Get single purchase by ID
router.get("/:id", getPurchaseById);

// @route   POST /api/purchases
// @desc    Create new purchase
router.post("/", approvalInterceptor("create_purchase"), createPurchase);

// @route   PUT /api/purchases/:id
// @desc    Update purchase
router.put("/:id", approvalInterceptor("edit_purchase", { model: Purchase }), updatePurchase);

// @route   DELETE /api/purchases/:id
// @desc    Delete purchase
router.delete("/:id", approvalInterceptor("delete_purchase", { model: Purchase }), deletePurchase);

module.exports = router;
