const Project = require("../models/Project");
const SalesInvoice = require("../models/SalesInvoice");
const Purchase = require("../models/Purchase");
const BankPayment = require("../models/BankPayment");
const CashPayment = require("../models/CashPayment");
const Plot = require("../models/Plot");
const Item = require("../models/Item");
const Supplier = require("../models/Supplier");
const Customer = require("../models/Customer");
const ChartOfAccount = require("../models/ChartOfAccount");

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    // Determine authorization for financial data visibility
    const canViewSales =
      req.user.role === "admin" ||
      (req.user.role === "custom" && req.user.customPermissions?.salesInvoice === true);

    const canViewExpenses =
      req.user.role === "admin" ||
      (req.user.role === "custom" && (
        req.user.customPermissions?.purchaseEntry === true ||
        req.user.customPermissions?.cashPayment === true ||
        req.user.customPermissions?.bankPayment === true
      ));

    const canViewProfit = canViewSales && canViewExpenses;

    // Get all sales invoices conditionally
    let totalSales = 0;
    if (canViewSales) {
      const salesInvoices = await SalesInvoice.find({ tenantId: req.tenantId });
      totalSales = salesInvoices.reduce(
        (sum, invoice) => sum + (invoice.netTotal || 0),
        0
      );
    }

    // Get all purchases and payments conditionally for total expenses
    let totalExpenses = 0;
    if (canViewExpenses) {
      const purchases = await Purchase.find({ tenantId: req.tenantId });
      const purchaseExpenses = purchases.reduce(
        (sum, purchase) => sum + (purchase.netAmount || 0),
        0
      );

      const bankPayments = await BankPayment.find({
        tenantId: req.tenantId,
        cancel: false,
      });
      const bankPaymentExpenses = bankPayments.reduce(
        (sum, payment) => sum + (payment.totalAmount || 0),
        0
      );

      const cashPayments = await CashPayment.find({
        tenantId: req.tenantId,
        cancel: false,
      });
      const cashPaymentExpenses = cashPayments.reduce(
        (sum, payment) => sum + (payment.totalAmount || 0),
        0
      );

      totalExpenses = purchaseExpenses + bankPaymentExpenses + cashPaymentExpenses;
    }

    // Calculate net profit
    const netProfit = totalSales - totalExpenses;

    // Get active projects count
    const activeProjectsCount = await Project.countDocuments({
      tenantId: req.tenantId,
      status: "Active",
    });

    // Calculate month-over-month changes
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Last month's sales conditionally
    let lastMonthSalesTotal = 0;
    if (canViewSales) {
      const lastMonthSales = await SalesInvoice.find({
        tenantId: req.tenantId,
        date: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
      });
      lastMonthSalesTotal = lastMonthSales.reduce(
        (sum, invoice) => sum + (invoice.netTotal || 0),
        0
      );
    }

    // Last month's expenses conditionally
    let lastMonthExpenses = 0;
    if (canViewExpenses) {
      const lastMonthPurchases = await Purchase.find({
        tenantId: req.tenantId,
        date: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
      });
      const lastMonthPurchaseExpenses = lastMonthPurchases.reduce(
        (sum, purchase) => sum + (purchase.netAmount || 0),
        0
      );

      const lastMonthBankPayments = await BankPayment.find({
        tenantId: req.tenantId,
        cancel: false,
        date: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
      });
      const lastMonthBankPaymentExpenses = lastMonthBankPayments.reduce(
        (sum, payment) => sum + (payment.totalAmount || 0),
        0
      );

      const lastMonthCashPayments = await CashPayment.find({
        tenantId: req.tenantId,
        cancel: false,
        date: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
      });
      const lastMonthCashPaymentExpenses = lastMonthCashPayments.reduce(
        (sum, payment) => sum + (payment.totalAmount || 0),
        0
      );

      lastMonthExpenses =
        lastMonthPurchaseExpenses +
        lastMonthBankPaymentExpenses +
        lastMonthCashPaymentExpenses;
    }
    const lastMonthProfit = lastMonthSalesTotal - lastMonthExpenses;

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? "+100%" : "0%";
      }
      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${change.toFixed(1)}%`;
    };

    const expensesChange = calculateChange(totalExpenses, lastMonthExpenses);
    const salesChange = calculateChange(totalSales, lastMonthSalesTotal);
    const profitChange = calculateChange(netProfit, lastMonthProfit);
    const lastMonthActiveProjects = await Project.countDocuments({
      status: "Active",
      tenantId: req.tenantId,
      createdAt: { $lt: firstDayThisMonth },
    });

    const projectsDiff = activeProjectsCount - lastMonthActiveProjects;
    const projectsChange =
      projectsDiff >= 0 ? `+${projectsDiff}` : `${projectsDiff}`;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalExpenses: canViewExpenses ? totalExpenses : null,
          expensesChange: canViewExpenses ? expensesChange : null,
          totalSales: canViewSales ? totalSales : null,
          salesChange: canViewSales ? salesChange : null,
          netProfit: canViewProfit ? netProfit : null,
          profitChange: canViewProfit ? profitChange : null,
          activeProjects: activeProjectsCount,
          projectsChange,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
};

// @desc    Get recent projects for dashboard
// @route   GET /api/dashboard/recent-projects
// @access  Private
const getRecentProjects = async (req, res) => {
  try {
    const query = req.sanitizedQuery || req.query;
    const limit = parseInt(query.limit) || 5;

    // Get recent projects sorted by creation date
    const projects = await Project.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("createdBy", "name");

    // Calculate spent amount for each project from purchases and bank payments
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        // Get all purchases for this project
        const projectPurchases = await Purchase.find({
          tenantId: req.tenantId,
          project: project._id,
        });

        // Calculate total from purchases
        const purchaseSpent = projectPurchases.reduce(
          (sum, purchase) => sum + (purchase.netAmount || 0),
          0
        );

        // Get all bank payments for this project (not cancelled)
        const projectBankPayments = await BankPayment.find({
          tenantId: req.tenantId,
          project: project._id,
          cancel: false,
        });

        // Calculate total from bank payments
        const bankPaymentSpent = projectBankPayments.reduce(
          (sum, payment) => sum + (payment.totalAmount || 0),
          0
        );

        // Get all cash payments for this project (not cancelled)
        const projectCashPayments = await CashPayment.find({
          tenantId: req.tenantId,
          project: project._id,
          cancel: false,
        });

        // Calculate total from cash payments
        const cashPaymentSpent = projectCashPayments.reduce(
          (sum, payment) => sum + (payment.totalAmount || 0),
          0
        );

        // Get all sales invoices for this project (revenue)
        const projectInvoices = await SalesInvoice.find({
          tenantId: req.tenantId,
          project: project._id,
        });

        // Calculate total revenue
        const revenue = projectInvoices.reduce(
          (sum, invoice) => sum + (invoice.netTotal || 0),
          0
        );

        // Total spent = purchases + bank payments + cash payments
        const spent = purchaseSpent + bankPaymentSpent + cashPaymentSpent;

        // Calculate progress percentage based on budget
        const budget = project.valueOfJob || project.estimatedCost || 0;
        const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

        return {
          _id: project._id,
          name: project.name,
          status: project.status,
          progress: Math.round(progress),
          budget: budget,
          spent: spent,
          revenue: revenue,
          client: project.client,
          jobIncharge: project.jobIncharge,
          startDate: project.startDate,
          completionDate: project.completionDate,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: projectsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching recent projects:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent projects",
      error: error.message,
    });
  }
};

// @desc    Get plot statistics for dashboard
// @route   GET /api/dashboard/plot-stats
// @access  Private
const getPlotStats = async (req, res) => {
  try {
    // Get all plots, not just active ones, to show sold plots too
    const plots = await Plot.find({ tenantId: req.tenantId });

    const stats = {
      total: plots.length,
      available: plots.filter((p) => p.status === "Available").length,
      booked: plots.filter((p) => p.status === "Booked").length,
      sold: plots.filter((p) => p.status === "Sold").length,
      underConstruction: plots.filter((p) => p.status === "Under Construction")
        .length,
      totalInventoryValue: plots
        .filter((p) => p.status === "Available")
        .reduce((sum, p) => sum + (p.basePrice || 0), 0),
      totalSalesValue: plots
        .filter((p) => p.status === "Sold")
        .reduce(
          (sum, p) => sum + (p.grossAmount || p.finalPrice || p.basePrice || 0),
          0
        ),
      totalReceived: plots
        .filter((p) => p.status === "Sold" || p.status === "Booked")
        .reduce((sum, p) => sum + (p.amountReceived || 0), 0),
      totalOutstanding: plots
        .filter((p) => p.status === "Sold" || p.status === "Booked")
        .reduce((sum, p) => sum + (p.balance || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching plot stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching plot statistics",
      error: error.message,
    });
  }
};

// @desc    Get inventory statistics (materials only, no plots)
// @route   GET /api/dashboard/inventory-stats
// @access  Private
const getInventoryStats = async (req, res) => {
  try {
    // Get only materials, equipment, services - exclude Plots
    const items = await Item.find({
      tenantId: req.tenantId,
      isActive: true,
      itemType: { $ne: "Plot" },
    });

    const stats = {
      totalItems: items.length,
      lowStockCount: items.filter(
        (item) =>
          item.currentStock > 0 &&
          item.currentStock <= (item.minStockLevel || 0)
      ).length,
      outOfStockCount: items.filter((item) => item.currentStock <= 0).length,
      totalInventoryValue: items.reduce(
        (sum, item) =>
          sum + (item.currentStock || 0) * (item.purchasePrice || 0),
        0
      ),
      categories: [...new Set(items.map((item) => item.categoryName))].length,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching inventory stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory statistics",
      error: error.message,
    });
  }
};

// @desc    Get expense breakdown by category
// @route   GET /api/dashboard/expense-breakdown
// @access  Private
const getExpenseBreakdown = async (req, res) => {
  try {
    // Get all purchases (without populate to avoid errors if items don't exist)
    const purchases = await Purchase.find({ tenantId: req.tenantId });

    // Get all bank payments with account details
    const bankPayments = await BankPayment.find({
      tenantId: req.tenantId,
      cancel: false,
    });

    // Get all cash payments
    const cashPayments = await CashPayment.find({
      tenantId: req.tenantId,
      cancel: false,
    });

    // Calculate material expenses from purchases
    const materialsTotal = purchases.reduce(
      (sum, purchase) => sum + (purchase.netAmount || 0),
      0
    );

    // Categorize bank and cash payments by account type
    let laborTotal = 0;
    let equipmentTotal = 0;
    let adminTotal = 0;
    let otherTotal = 0;

    // Process bank payments
    bankPayments.forEach((payment) => {
      payment.paymentLines?.forEach((line) => {
        const accountName = line.accountName?.toLowerCase() || "";
        const amount = line.amount || 0;

        if (
          accountName.includes("labor") ||
          accountName.includes("wage") ||
          accountName.includes("salary")
        ) {
          laborTotal += amount;
        } else if (
          accountName.includes("equipment") ||
          accountName.includes("machinery") ||
          accountName.includes("rental")
        ) {
          equipmentTotal += amount;
        } else if (
          accountName.includes("admin") ||
          accountName.includes("office") ||
          accountName.includes("utility")
        ) {
          adminTotal += amount;
        } else {
          otherTotal += amount;
        }
      });
    });

    // Process cash payments
    cashPayments.forEach((payment) => {
      payment.paymentLines?.forEach((line) => {
        const accountName = line.accountName?.toLowerCase() || "";
        const amount = line.amount || 0;

        if (
          accountName.includes("labor") ||
          accountName.includes("wage") ||
          accountName.includes("salary")
        ) {
          laborTotal += amount;
        } else if (
          accountName.includes("equipment") ||
          accountName.includes("machinery") ||
          accountName.includes("rental")
        ) {
          equipmentTotal += amount;
        } else if (
          accountName.includes("admin") ||
          accountName.includes("office") ||
          accountName.includes("utility")
        ) {
          adminTotal += amount;
        } else {
          otherTotal += amount;
        }
      });
    });

    const data = [
      { name: "Materials", value: materialsTotal, color: "#f59e0b" },
      { name: "Labor", value: laborTotal, color: "#8b5cf6" },
      { name: "Equipment", value: equipmentTotal, color: "#ec4899" },
      { name: "Administrative", value: adminTotal, color: "#06b6d4" },
      { name: "Other", value: otherTotal, color: "#6366f1" },
    ];

    res.status(200).json({
      success: true,
      data: data.filter((item) => item.value > 0), // Only return categories with expenses
    });
  } catch (error) {
    console.error("Error fetching expense breakdown:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching expense breakdown",
      error: error.message,
    });
  }
};

// @desc    Get monthly revenue trend (last 6 months)
// @route   GET /api/dashboard/revenue-trend
// @access  Private
const getRevenueTrend = async (req, res) => {
  try {
    const months = 6;
    const data = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const invoices = await SalesInvoice.find({
        tenantId: req.tenantId,
        date: { $gte: monthStart, $lte: monthEnd },
      });

      const revenue = invoices.reduce(
        (sum, inv) => sum + (inv.netTotal || 0),
        0
      );

      data.push({
        month: monthStart.toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
        revenue: revenue,
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching revenue trend:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue trend",
      error: error.message,
    });
  }
};

// @desc    Get revenue vs expenses comparison (last 6 months)
// @route   GET /api/dashboard/revenue-vs-expenses
// @access  Private
const getRevenueVsExpenses = async (req, res) => {
  try {
    const months = 6;
    const data = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Revenue
      const invoices = await SalesInvoice.find({
        tenantId: req.tenantId,
        date: { $gte: monthStart, $lte: monthEnd },
      });
      const revenue = invoices.reduce(
        (sum, inv) => sum + (inv.netTotal || 0),
        0
      );

      // Expenses
      const purchases = await Purchase.find({
        tenantId: req.tenantId,
        date: { $gte: monthStart, $lte: monthEnd },
      });
      const purchaseExpenses = purchases.reduce(
        (sum, p) => sum + (p.netAmount || 0),
        0
      );

      const bankPayments = await BankPayment.find({
        tenantId: req.tenantId,
        cancel: false,
        date: { $gte: monthStart, $lte: monthEnd },
      });
      const bankExpenses = bankPayments.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );

      const cashPayments = await CashPayment.find({
        tenantId: req.tenantId,
        cancel: false,
        date: { $gte: monthStart, $lte: monthEnd },
      });
      const cashExpenses = cashPayments.reduce(
        (sum, c) => sum + (c.totalAmount || 0),
        0
      );

      const expenses = purchaseExpenses + bankExpenses + cashExpenses;

      data.push({
        month: monthStart.toLocaleString("default", { month: "short" }),
        revenue: revenue,
        expenses: expenses,
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching revenue vs expenses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue vs expenses",
      error: error.message,
    });
  }
};

// @desc    Get project status distribution
// @route   GET /api/dashboard/project-status
// @access  Private
const getProjectStatusDistribution = async (req, res) => {
  try {
    const projects = await Project.find({ tenantId: req.tenantId });

    const statusCounts = {};
    projects.forEach((project) => {
      const status = project.status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const colors = {
      Active: "#10b981",
      Completed: "#3b82f6",
      "On Hold": "#f59e0b",
      Planning: "#8b5cf6",
      Cancelled: "#ef4444",
      Unknown: "#6b7280",
    };

    const data = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      color: colors[status] || "#6b7280",
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching project status distribution:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project status distribution",
      error: error.message,
    });
  }
};

// @desc    Get cash flow summary
// @route   GET /api/dashboard/cash-flow
// @access  Private
const getCashFlow = async (req, res) => {
  try {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Cash In (Revenue this month)
    const invoices = await SalesInvoice.find({
      tenantId: req.tenantId,
      date: { $gte: firstDayThisMonth },
    });
    const cashIn = invoices.reduce((sum, inv) => sum + (inv.netTotal || 0), 0);

    // Cash Out (Expenses this month)
    const purchases = await Purchase.find({
      tenantId: req.tenantId,
      date: { $gte: firstDayThisMonth },
    });
    const purchaseExpenses = purchases.reduce(
      (sum, p) => sum + (p.netAmount || 0),
      0
    );

    const bankPayments = await BankPayment.find({
      tenantId: req.tenantId,
      cancel: false,
      date: { $gte: firstDayThisMonth },
    });
    const bankExpenses = bankPayments.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    );

    const cashPayments = await CashPayment.find({
      tenantId: req.tenantId,
      cancel: false,
      date: { $gte: firstDayThisMonth },
    });
    const cashExpenses = cashPayments.reduce(
      (sum, c) => sum + (c.totalAmount || 0),
      0
    );

    const cashOut = purchaseExpenses + bankExpenses + cashExpenses;
    const netFlow = cashIn - cashOut;

    res.status(200).json({
      success: true,
      data: {
        cashIn,
        cashOut,
        netFlow,
        isPositive: netFlow >= 0,
      },
    });
  } catch (error) {
    console.error("Error fetching cash flow:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cash flow",
      error: error.message,
    });
  }
};

// @desc    Get top 5 projects by revenue
// @route   GET /api/dashboard/top-projects
// @access  Private
const getTopProjects = async (req, res) => {
  try {
    const projects = await Project.find({ tenantId: req.tenantId });

    const projectsWithRevenue = await Promise.all(
      projects.map(async (project) => {
        const invoices = await SalesInvoice.find({
          tenantId: req.tenantId,
          project: project._id,
        });
        const revenue = invoices.reduce(
          (sum, inv) => sum + (inv.netTotal || 0),
          0
        );

        return {
          name: project.name,
          revenue: revenue,
          status: project.status,
        };
      })
    );

    // Sort by revenue and get top 5
    const topProjects = projectsWithRevenue
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: topProjects,
    });
  } catch (error) {
    console.error("Error fetching top projects:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching top projects",
      error: error.message,
    });
  }
};

// @desc    Get projects over budget
// @route   GET /api/dashboard/projects-over-budget
// @access  Private
const getProjectsOverBudget = async (req, res) => {
  try {
    const projects = await Project.find({ tenantId: req.tenantId });

    const projectsWithBudget = await Promise.all(
      projects.map(async (project) => {
        const purchases = await Purchase.find({
          tenantId: req.tenantId,
          project: project._id,
        });
        const purchaseSpent = purchases.reduce(
          (sum, p) => sum + (p.netAmount || 0),
          0
        );

        const bankPayments = await BankPayment.find({
          tenantId: req.tenantId,
          project: project._id,
          cancel: false,
        });
        const bankSpent = bankPayments.reduce(
          (sum, b) => sum + (b.totalAmount || 0),
          0
        );

        const cashPayments = await CashPayment.find({
          tenantId: req.tenantId,
          project: project._id,
          cancel: false,
        });
        const cashSpent = cashPayments.reduce(
          (sum, c) => sum + (c.totalAmount || 0),
          0
        );

        const spent = purchaseSpent + bankSpent + cashSpent;
        const budget = project.valueOfJob || project.estimatedCost || 0;
        const percentage = budget > 0 ? (spent / budget) * 100 : 0;

        return {
          name: project.name,
          budget: budget,
          spent: spent,
          percentage: Math.round(percentage),
          status:
            percentage >= 100 ? "over" : percentage >= 90 ? "warning" : "good",
        };
      })
    );

    // Filter projects over or near budget
    const alertProjects = projectsWithBudget
      .filter((p) => p.percentage >= 90 && p.budget > 0)
      .sort((a, b) => b.percentage - a.percentage);

    res.status(200).json({
      success: true,
      data: alertProjects,
    });
  } catch (error) {
    console.error("Error fetching projects over budget:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects over budget",
      error: error.message,
    });
  }
};

// @desc    Get accounts receivable summary
// @route   GET /api/dashboard/accounts-receivable
// @access  Private
const getAccountsReceivable = async (req, res) => {
  try {
    const customers = await Customer.find({
      tenantId: req.tenantId,
      isActive: true,
    });

    const totalOutstanding = customers.reduce(
      (sum, c) => sum + (c.balance || 0),
      0
    );

    // Calculate overdue (simplified - customers with balance > 30 days old)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invoices = await SalesInvoice.find({
      tenantId: req.tenantId,
      date: { $lt: thirtyDaysAgo },
    }).populate("customer");

    let overdueAmount = 0;
    invoices.forEach((inv) => {
      if (inv.customer && inv.customer.balance > 0) {
        overdueAmount += inv.netTotal || 0;
      }
    });

    const currentAmount = totalOutstanding - overdueAmount;

    res.status(200).json({
      success: true,
      data: {
        totalOutstanding,
        overdue: overdueAmount,
        current: currentAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching accounts receivable:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching accounts receivable",
      error: error.message,
    });
  }
};

// @desc    Get accounts payable summary
// @route   GET /api/dashboard/accounts-payable
// @access  Private
const getAccountsPayable = async (req, res) => {
  try {
    const suppliers = await Supplier.find({
      tenantId: req.tenantId,
      status: "active",
    });

    const totalPayable = suppliers.reduce(
      (sum, s) => sum + Math.abs(s.balance || 0),
      0
    );

    // Simplified overdue calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const purchases = await Purchase.find({
      tenantId: req.tenantId,
      date: { $lt: thirtyDaysAgo },
    }).populate("supplier");

    let overdueAmount = 0;
    purchases.forEach((purchase) => {
      if (purchase.supplier && purchase.supplier.balance < 0) {
        overdueAmount += purchase.netAmount || 0;
      }
    });

    const dueSoonAmount = totalPayable - overdueAmount;

    res.status(200).json({
      success: true,
      data: {
        totalPayable,
        overdue: overdueAmount,
        dueSoon: dueSoonAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching accounts payable:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching accounts payable",
      error: error.message,
    });
  }
};

// @desc    Get low stock alerts
// @route   GET /api/dashboard/low-stock-alerts
// @access  Private
const getLowStockAlerts = async (req, res) => {
  try {
    const items = await Item.find({
      tenantId: req.tenantId,
      isActive: true,
      itemType: { $ne: "Plot" },
    });

    const lowStockItems = items
      .filter((item) => {
        const stock = item.currentStock || 0;
        const minLevel = item.minStockLevel || 0;
        return stock > 0 && stock <= minLevel;
      })
      .map((item) => ({
        name: item.name,
        currentStock: item.currentStock || 0,
        minStock: item.minStockLevel || 0,
        unit: item.unit || "units",
      }))
      .slice(0, 10); // Limit to top 10

    res.status(200).json({
      success: true,
      data: lowStockItems,
    });
  } catch (error) {
    console.error("Error fetching low stock alerts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching low stock alerts",
      error: error.message,
    });
  }
};

// @desc    Get top suppliers by volume
// @route   GET /api/dashboard/top-suppliers
// @access  Private
const getTopSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({
      tenantId: req.tenantId,
      status: "active",
    });

    const topSuppliers = suppliers
      .sort((a, b) => (b.totalPurchases || 0) - (a.totalPurchases || 0))
      .slice(0, 5)
      .map((supplier) => ({
        name: supplier.name,
        company: supplier.company,
        totalPurchases: supplier.totalPurchases || 0,
        category: supplier.category,
      }));

    res.status(200).json({
      success: true,
      data: topSuppliers,
    });
  } catch (error) {
    console.error("Error fetching top suppliers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching top suppliers",
      error: error.message,
    });
  }
};

// @desc    Get top customers by revenue
// @route   GET /api/dashboard/top-customers
// @access  Private
const getTopCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({
      tenantId: req.tenantId,
      isActive: true,
    });

    const topCustomers = customers
      .sort((a, b) => (b.totalPurchase || 0) - (a.totalPurchase || 0))
      .slice(0, 5)
      .map((customer) => ({
        name: customer.name,
        totalPurchase: customer.totalPurchase || 0,
        balance: customer.balance || 0,
        email: customer.email,
      }));

    res.status(200).json({
      success: true,
      data: topCustomers,
    });
  } catch (error) {
    console.error("Error fetching top customers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching top customers",
      error: error.message,
    });
  }
};

module.exports = {
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
};
