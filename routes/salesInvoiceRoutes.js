const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");
const {
  getAllSalesInvoices,
  getSalesInvoiceById,
  createSalesInvoice,
  updateSalesInvoice,
  deleteSalesInvoice,
  getSalesInvoicesByCustomer,
  getSalesInvoicesByProject,
  getSalesInvoicesByDateRange,
} = require("../controllers/salesInvoiceController");

const SalesInvoice = require("../models/SalesInvoice");
const PERMISSIONS = require("../constants/permissions");

// All routes are protected and permission-scoped
router.use(protect);
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.SALES_INVOICE));

// Base routes
router
  .route("/")
  .get(getAllSalesInvoices)
  .post(approvalInterceptor("create_sales_invoice"), createSalesInvoice);

// Date range route (must be before /:id)
router.route("/daterange").get(getSalesInvoicesByDateRange);

// Customer and project specific routes
router.route("/customer/:customerId").get(getSalesInvoicesByCustomer);
router.route("/project/:projectId").get(getSalesInvoicesByProject);

// Single invoice routes
router
  .route("/:id")
  .get(getSalesInvoiceById)
  .put(approvalInterceptor("edit_sales_invoice", { model: SalesInvoice }), updateSalesInvoice)
  .delete(approvalInterceptor("delete_sales_invoice", { model: SalesInvoice }), deleteSalesInvoice);

module.exports = router;
