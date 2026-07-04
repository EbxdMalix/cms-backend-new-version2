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
const PERMISSIONS = require("../constants/permissions");
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.DASHBOARD));

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get("/stats", getDashboardStats);

// @route   GET /api/dashboard/recent-projects
// @desc    Get recent projects
// @access  Private
router.get("/recent-projects", getRecentProjects);

// @route   GET /api/dashboard/plot-stats
// @desc    Get plot statistics
// @access  Private
router.get("/plot-stats", getPlotStats);

// @route   GET /api/dashboard/inventory-stats
// @desc    Get inventory statistics (materials only)
// @access  Private
router.get("/inventory-stats", getInventoryStats);

// @route   GET /api/dashboard/expense-breakdown
// @desc    Get expense breakdown by category
// @access  Private
router.get("/expense-breakdown", getExpenseBreakdown);

// @route   GET /api/dashboard/revenue-trend
// @desc    Get monthly revenue trend
// @access  Private
router.get("/revenue-trend", getRevenueTrend);

// @route   GET /api/dashboard/revenue-vs-expenses
// @desc    Get revenue vs expenses comparison
// @access  Private
router.get("/revenue-vs-expenses", getRevenueVsExpenses);

// @route   GET /api/dashboard/project-status
// @desc    Get project status distribution
// @access  Private
router.get("/project-status", getProjectStatusDistribution);

// @route   GET /api/dashboard/cash-flow
// @desc    Get cash flow summary
// @access  Private
router.get("/cash-flow", getCashFlow);

// @route   GET /api/dashboard/top-projects
// @desc    Get top 5 projects by revenue
// @access  Private
router.get("/top-projects", getTopProjects);

// @route   GET /api/dashboard/projects-over-budget
// @desc    Get projects over budget
// @access  Private
router.get("/projects-over-budget", getProjectsOverBudget);

// @route   GET /api/dashboard/accounts-receivable
// @desc    Get accounts receivable summary
// @access  Private
router.get("/accounts-receivable", getAccountsReceivable);

// @route   GET /api/dashboard/accounts-payable
// @desc    Get accounts payable summary
// @access  Private
router.get("/accounts-payable", getAccountsPayable);

// @route   GET /api/dashboard/low-stock-alerts
// @desc    Get low stock alerts
// @access  Private
router.get("/low-stock-alerts", getLowStockAlerts);

// @route   GET /api/dashboard/top-suppliers
// @desc    Get top suppliers by volume
// @access  Private
router.get("/top-suppliers", getTopSuppliers);

// @route   GET /api/dashboard/top-customers
// @desc    Get top customers by revenue
// @access  Private
router.get("/top-customers", getTopCustomers);

module.exports = router;
