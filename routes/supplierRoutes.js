const express = require("express");
const router = express.Router();
const {
  getAllSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersByCategory,
} = require("../controllers/supplierController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const Supplier = require("../models/Supplier");
const PERMISSIONS = require("../constants/permissions");

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/suppliers
// @desc    Get all suppliers (for dropdown selection)
router.get("/", getAllSuppliers);

const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.SUPPLIERS));

// Supplier routes
router.post("/", approvalInterceptor("create_supplier"), createSupplier);

router
  .route("/:id")
  .get(getSupplier)
  .put(approvalInterceptor("edit_supplier", { model: Supplier }), updateSupplier)
  .delete(approvalInterceptor("delete_supplier", { model: Supplier }), deleteSupplier);

router.route("/category/:category").get(getSuppliersByCategory);

module.exports = router;
