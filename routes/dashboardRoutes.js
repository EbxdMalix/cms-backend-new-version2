const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getDashboardStats,
  getRecentProjects,
  getPlotStats,
  getInventoryStats,
  getExpenseBreakdown,
  getRevenueTrend,
  getRevenueVsExpenses,
  getProjectStatusDistribution,
  getCashFlow,
  getTopProjects,
  getProjectsOverBudget,
  getAccountsReceivable,
  getAccountsPayable,
  getLowStockAlerts,
  getTopSuppliers,
  getTopCustomers,
} = require("../controllers/dashboardController");

// All routes are protected and permission-scoped
router.use(protect);
const { apiLimiter } = require("../middleware/rateLimiters");
router.use(apiLimiter);

const PERMISSIONS = require("../constants/permissions");
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.DASHBOARD));

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get("/stats", getDashboardStats);

// @route   GET /api/dashboard/recent-projects
// @desc    Get recent projects
// @access  Private
router.get("/recent-projects", checkPermission(PERMISSIONS.PROJECTS), getRecentProjects);

// @route   GET /api/dashboard/plot-stats
// @desc    Get plot statistics
// @access  Private
router.get("/plot-stats", checkPermission(PERMISSIONS.PLOTS), getPlotStats);

// @route   GET /api/dashboard/inventory-stats
// @desc    Get inventory statistics (materials only)
// @access  Private
router.get("/inventory-stats", checkPermission(PERMISSIONS.ITEMS), getInventoryStats);

// @route   GET /api/dashboard/expense-breakdown
// @desc    Get expense breakdown by category
// @access  Private
router.get("/expense-breakdown", checkPermission(PERMISSIONS.ACCOUNTING), getExpenseBreakdown);

// @route   GET /api/dashboard/revenue-trend
// @desc    Get monthly revenue trend
// @access  Private
router.get("/revenue-trend", checkPermission(PERMISSIONS.ACCOUNTING), getRevenueTrend);

// @route   GET /api/dashboard/revenue-vs-expenses
// @desc    Get revenue vs expenses comparison
// @access  Private
router.get("/revenue-vs-expenses", checkPermission(PERMISSIONS.ACCOUNTING), getRevenueVsExpenses);

// @route   GET /api/dashboard/project-status
// @desc    Get project status distribution
// @access  Private
router.get("/project-status", checkPermission(PERMISSIONS.PROJECTS), getProjectStatusDistribution);

// @route   GET /api/dashboard/cash-flow
// @desc    Get cash flow summary
// @access  Private
router.get("/cash-flow", checkPermission(PERMISSIONS.ACCOUNTING), getCashFlow);

// @route   GET /api/dashboard/top-projects
// @desc    Get top 5 projects by revenue
// @access  Private
router.get("/top-projects", checkPermission(PERMISSIONS.PROJECTS), getTopProjects);

// @route   GET /api/dashboard/projects-over-budget
// @desc    Get projects over budget
// @access  Private
router.get("/projects-over-budget", checkPermission(PERMISSIONS.PROJECTS), getProjectsOverBudget);

// @route   GET /api/dashboard/accounts-receivable
// @desc    Get accounts receivable summary
// @access  Private
router.get("/accounts-receivable", checkPermission(PERMISSIONS.ACCOUNTING), getAccountsReceivable);

// @route   GET /api/dashboard/accounts-payable
// @desc    Get accounts payable summary
// @access  Private
router.get("/accounts-payable", checkPermission(PERMISSIONS.ACCOUNTING), getAccountsPayable);

// @route   GET /api/dashboard/low-stock-alerts
// @desc    Get low stock alerts
// @access  Private
router.get("/low-stock-alerts", checkPermission(PERMISSIONS.ITEMS), getLowStockAlerts);

// @route   GET /api/dashboard/top-suppliers
// @desc    Get top suppliers by volume
// @access  Private
router.get("/top-suppliers", checkPermission(PERMISSIONS.SUPPLIERS), getTopSuppliers);

// @route   GET /api/dashboard/top-customers
// @desc    Get top customers by revenue
// @access  Private
router.get("/top-customers", checkPermission(PERMISSIONS.CUSTOMERS), getTopCustomers);

module.exports = router;
