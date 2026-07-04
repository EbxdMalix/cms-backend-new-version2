const Project = require("../models/Project");

// @desc    Create new project
// @route   POST /api/projects
// @access  Private
exports.createProject = async (req, res) => {
  try {
    // Map frontend field names to backend field names
    const {
      name,
      client,
      telephone,
      address,
      code,
      contact,
      projectNo,
      jobNo,
      projectDescription,
      jobDescription,
      orderNo,
      orderDate,
      expiryDate,
      deliveryDate,
      valueOfProject,
      valueOfJob,
      projectCompleted,
      jobCompleted,
      startDate,
      completionDate,
      estimatedCost,
      projectIncharge,
      jobIncharge,
      status,
    } = req.body;

    // Use frontend names if provided, otherwise fall back to backend names
    const mappedJobNo = projectNo || jobNo;
    const mappedJobDescription = projectDescription || jobDescription;
    const mappedValueOfJob = valueOfProject || valueOfJob;
    const mappedJobCompleted =
      projectCompleted !== undefined ? projectCompleted : jobCompleted;
    const mappedJobIncharge = projectIncharge || jobIncharge;

    // Validation
    if (
      !name ||
      !client ||
      !startDate ||
      !completionDate ||
      !estimatedCost ||
      !mappedJobIncharge
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: name, client, startDate, completionDate, estimatedCost, and jobIncharge",
      });
    }

    // Validate status if provided
    const validStatuses = ["Active", "Completed", "On Hold", "Cancelled"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Validate dates
    if (new Date(startDate) > new Date(completionDate)) {
      return res.status(400).json({
        success: false,
        message: "Completion date must be after start date",
      });
    }

    // Create project data
    const projectData = {
      tenantId: req.tenantId,
      name,
      client,
      telephone,
      address,
      code,
      contact,
      jobNo: mappedJobNo,
      jobDescription: mappedJobDescription,
      orderNo,
      orderDate,
      expiryDate,
      deliveryDate,
      valueOfJob: mappedValueOfJob,
      jobCompleted: mappedJobCompleted || false,
      startDate,
      completionDate,
      estimatedCost,
      jobIncharge: mappedJobIncharge,
      // Sync status with jobCompleted: if completed, status is "Completed", otherwise use provided status or "Active"
      status: mappedJobCompleted ? "Completed" : status || "Active",
      createdBy: req.user.id,
    };

    // Create new project
    const project = await Project.create(projectData);

    // Populate references
    await project.populate("createdBy", "name email role");

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating project",
      error: error.message,
    });
  }
};

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({ tenantId: req.tenantId })
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.error("Get all projects error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects",
      error: error.message,
    });
  }
};

// @desc    Get single project by ID
// @route   GET /api/projects/:id
// @access  Private
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).populate("createdBy", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Get project by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project",
      error: error.message,
    });
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
exports.updateProject = async (req, res) => {
  try {
    // Map frontend field names to backend field names
    const {
      name,
      client,
      telephone,
      address,
      code,
      contact,
      projectNo,
      jobNo,
      projectDescription,
      jobDescription,
      orderNo,
      orderDate,
      expiryDate,
      deliveryDate,
      valueOfProject,
      valueOfJob,
      projectCompleted,
      jobCompleted,
      startDate,
      completionDate,
      estimatedCost,
      projectIncharge,
      jobIncharge,
      status,
    } = req.body;

    // Use frontend names if provided, otherwise fall back to backend names
    const mappedJobNo = projectNo || jobNo;
    const mappedJobDescription = projectDescription || jobDescription;
    const mappedValueOfJob = valueOfProject || valueOfJob;
    const mappedJobCompleted =
      projectCompleted !== undefined ? projectCompleted : jobCompleted;
    const mappedJobIncharge = projectIncharge || jobIncharge;

    const project = await Project.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Validate status if provided
    const validStatuses = ["Active", "Completed", "On Hold", "Cancelled"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Validate dates if both are provided
    const newStartDate = startDate || project.startDate;
    const newCompletionDate = completionDate || project.completionDate;
    if (new Date(newStartDate) > new Date(newCompletionDate)) {
      return res.status(400).json({
        success: false,
        message: "Completion date must be after start date",
      });
    }

    // Update fields
    if (name !== undefined) project.name = name;
    if (client !== undefined) project.client = client;
    if (telephone !== undefined) project.telephone = telephone;
    if (address !== undefined) project.address = address;
    if (code !== undefined) project.code = code;
    if (contact !== undefined) project.contact = contact;
    if (mappedJobNo !== undefined) project.jobNo = mappedJobNo;
    if (mappedJobDescription !== undefined)
      project.jobDescription = mappedJobDescription;
    if (orderNo !== undefined) project.orderNo = orderNo;
    if (orderDate !== undefined) project.orderDate = orderDate;
    if (expiryDate !== undefined) project.expiryDate = expiryDate;
    if (deliveryDate !== undefined) project.deliveryDate = deliveryDate;
    if (mappedValueOfJob !== undefined) project.valueOfJob = mappedValueOfJob;
    if (mappedJobCompleted !== undefined) {
      project.jobCompleted = mappedJobCompleted;
      // Automatically sync status with jobCompleted
      if (mappedJobCompleted === true) {
        project.status = "Completed";
      } else if (project.status === "Completed") {
        // If unchecking completed, revert to Active
        project.status = "Active";
      }
    }
    if (startDate !== undefined) project.startDate = startDate;
    if (completionDate !== undefined) project.completionDate = completionDate;
    if (estimatedCost !== undefined) project.estimatedCost = estimatedCost;
    if (mappedJobIncharge !== undefined)
      project.jobIncharge = mappedJobIncharge;
    // Allow manual status override only if jobCompleted is not being changed
    if (status !== undefined && mappedJobCompleted === undefined)
      project.status = status;

    await project.save();

    // Populate references
    await project.populate("createdBy", "name email role");

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating project",
      error: error.message,
    });
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check for active transactions before deletion
    const Purchase = require("../models/Purchase");
    const SalesInvoice = require("../models/SalesInvoice");
    const BankPayment = require("../models/BankPayment");

    const purchaseCount = await Purchase.countDocuments({
      tenantId: req.tenantId,
      project: req.params.id,
    });
    const salesCount = await SalesInvoice.countDocuments({
      tenantId: req.tenantId,
      project: req.params.id,
    });
    const paymentCount = await BankPayment.countDocuments({
      tenantId: req.tenantId,
      project: req.params.id,
    });

    if (purchaseCount > 0 || salesCount > 0 || paymentCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete project with existing transactions",
        details: {
          purchases: purchaseCount,
          salesInvoices: salesCount,
          bankPayments: paymentCount,
        },
      });
    }

    await Project.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting project",
      error: error.message,
    });
  }
};

// @desc    Get project ledger with all expenses and profit calculation
// @route   GET /api/projects/:id/ledger
// @access  Private
exports.getProjectLedger = async (req, res) => {
  try {
    const Purchase = require("../models/Purchase");
    const BankPayment = require("../models/BankPayment");
    const CashPayment = require("../models/CashPayment");
    const SalesInvoice = require("../models/SalesInvoice");

    const project = await Project.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).populate("createdBy", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Get all purchases for this project
    const purchases = await Purchase.find({
      tenantId: req.tenantId,
      project: req.params.id,
    })
      .populate("item", "name itemCode")
      .populate("employeeReference", "name email")
      .sort({ date: 1 });

    // Get all bank payments for this project (if applicable)
    const bankPayments = await BankPayment.find({
      tenantId: req.tenantId,
      project: req.params.id,
    })
      .populate("employeeRef", "name email")
      .populate("createdBy", "name email")
      .sort({ date: 1 });

    // Get all cash payments for this project
    const cashPayments = await CashPayment.find({
      tenantId: req.tenantId,
      project: req.params.id,
    })
      .populate("employeeRef", "name email")
      .populate("createdBy", "name email")
      .sort({ date: 1 });

    // Get all sales invoices for this project
    const salesInvoices = await SalesInvoice.find({
      tenantId: req.tenantId,
      project: req.params.id,
    })
      .populate("customer", "name code email phone")
      .populate("employeeReference", "name email")
      .sort({ date: 1 });

    // Calculate totals
    const totalPurchases = purchases.reduce((sum, p) => sum + p.netAmount, 0);
    const totalBankPayments = bankPayments.reduce(
      (sum, b) => sum + b.totalAmount,
      0
    );
    const totalCashPayments = cashPayments.reduce(
      (sum, c) => sum + c.totalAmount,
      0
    );
    const totalSalesInvoices = salesInvoices.reduce(
      (sum, si) => sum + si.netTotal,
      0
    );
    const totalSalesReceived = salesInvoices.reduce(
      (sum, si) => sum + si.amountReceived,
      0
    );
    const totalOutstandingBalance = salesInvoices.reduce(
      (sum, si) => sum + si.balance,
      0
    );
    const totalExpenses =
      totalPurchases + totalBankPayments + totalCashPayments;

    // Calculate profit/loss - actual revenue from sales invoices
    const actualRevenue = totalSalesInvoices;
    const profitLoss = actualRevenue - totalExpenses;
    const profitMargin =
      actualRevenue > 0 ? ((profitLoss / actualRevenue) * 100).toFixed(2) : 0;

    // Group purchases by category for better insights
    const purchasesByVendor = {};
    purchases.forEach((purchase) => {
      const vendor = purchase.vendorName;
      if (!purchasesByVendor[vendor]) {
        purchasesByVendor[vendor] = {
          vendorName: vendor,
          vendorCode: purchase.vendorCode,
          totalAmount: 0,
          purchases: [],
        };
      }
      purchasesByVendor[vendor].totalAmount += purchase.netAmount;
      purchasesByVendor[vendor].purchases.push(purchase);
    });

    // Group bank payments by account type for better insights
    const paymentsByAccount = {};
    bankPayments.forEach((payment) => {
      payment.paymentLines.forEach((line) => {
        const accountName = line.accountName;
        if (!paymentsByAccount[accountName]) {
          paymentsByAccount[accountName] = {
            accountCode: line.accountCode,
            accountName: line.accountName,
            totalAmount: 0,
            count: 0,
            type: "Bank",
          };
        }
        paymentsByAccount[accountName].totalAmount += line.amount;
        paymentsByAccount[accountName].count += 1;
      });
    });

    // Group cash payments by account type for better insights
    cashPayments.forEach((payment) => {
      payment.paymentLines.forEach((line) => {
        const accountName = line.accountName;
        if (!paymentsByAccount[accountName]) {
          paymentsByAccount[accountName] = {
            accountCode: line.accountCode,
            accountName: line.accountName,
            totalAmount: 0,
            count: 0,
            type: "Cash",
          };
        } else {
          // If account exists from bank payments, mark as "Both"
          if (paymentsByAccount[accountName].type === "Bank") {
            paymentsByAccount[accountName].type = "Both";
          }
        }
        paymentsByAccount[accountName].totalAmount += line.amount;
        paymentsByAccount[accountName].count += 1;
      });
    });

    res.status(200).json({
      success: true,
      data: {
        project: {
          _id: project._id,
          name: project.name,
          code: project.code,
          client: project.client,
          estimatedCost: project.estimatedCost,
          valueOfJob: project.valueOfJob || 0,
          startDate: project.startDate,
          completionDate: project.completionDate,
          status: project.status,
          jobIncharge: project.jobIncharge,
        },
        summary: {
          estimatedCost: project.estimatedCost,
          estimatedRevenue: project.valueOfJob || 0,
          totalPurchases,
          totalBankPayments,
          totalCashPayments,
          totalExpenses,
          totalSalesInvoices,
          totalSalesReceived,
          totalOutstandingBalance,
          actualRevenue,
          profitLoss,
          profitMargin: `${profitMargin}%`,
          remainingBudget: project.estimatedCost - totalExpenses,
        },
        purchases,
        bankPayments,
        cashPayments,
        salesInvoices,
        purchasesByVendor: Object.values(purchasesByVendor),
        paymentsByAccount: Object.values(paymentsByAccount),
      },
    });
  } catch (error) {
    console.error("Get project ledger error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project ledger",
      error: error.message,
    });
  }
};
