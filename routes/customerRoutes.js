const express = require("express");
const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerByCode,
} = require("../controllers/customerController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const Customer = require("../models/Customer");
const PERMISSIONS = require("../constants/permissions");

// All routes are protected
router.use(protect);

// @route   GET /api/customers
// @desc    Get all customers (for dropdown selection)
router.get("/", getAllCustomers);

const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.CUSTOMERS));

// @route   GET /api/customers/code/:code
// @desc    Get customer by code
router.get("/code/:code", getCustomerByCode);

// @route   GET /api/customers/:id
// @desc    Get single customer by ID
router.get("/:id", getCustomerById);

// @route   POST /api/customers
// @desc    Create new customer
router.post("/", approvalInterceptor("create_customer"), createCustomer);

// @route   PUT /api/customers/:id
// @desc    Update customer
router.put("/:id", approvalInterceptor("edit_customer", { model: Customer }), updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Delete customer
router.delete("/:id", approvalInterceptor("delete_customer", { model: Customer }), deleteCustomer);

module.exports = router;
