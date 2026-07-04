const express = require("express");
const router = express.Router();
const {
  getChartOfAccounts,
  getChartOfAccountById,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  getAccountTypesEnum,
} = require("../controllers/chartOfAccountController");
const { protect } = require("../middleware/authMiddleware");

// All routes are protected and permission-scoped
router.use(protect);

// Get account types enum & accounts list (for dropdown selection)
router.get("/enums/types", getAccountTypesEnum);
router.get("/", getChartOfAccounts);

const PERMISSIONS = require("../constants/permissions");
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.CHART_OF_ACCOUNTS));

// CRUD operations
router.post("/", createChartOfAccount);

router
  .route("/:id")
  .get(getChartOfAccountById)
  .put(updateChartOfAccount)
  .delete(deleteChartOfAccount);

module.exports = router;
