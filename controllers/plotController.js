const Plot = require("../models/Plot");
const Project = require("../models/Project");
const Customer = require("../models/Customer");

// @desc    Get all plots
// @route   GET /api/plots
// @access  Private
exports.getAllPlots = async (req, res) => {
  try {
    const query = req.sanitizedQuery || req.query;
    const { project, status } = query;

    const filter = { tenantId: req.tenantId, isActive: true };
    if (project) filter.project = project;
    if (status) filter.status = status;

    const plots = await Plot.find(filter)
      .populate("project", "name code")
      .populate("customer", "name email phone")
      .populate("createdBy", "name email")
      .sort({ plotNumber: 1 });

    res.status(200).json({
      success: true,
      count: plots.length,
      data: plots,
    });
  } catch (error) {
    console.error("Get all plots error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching plots",
      error: error.message,
    });
  }
};

// @desc    Get single plot by ID
// @route   GET /api/plots/:id
// @access  Private
exports.getPlotById = async (req, res) => {
  try {
    const plot = await Plot.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate("project", "name code client location")
      .populate("customer", "name email phone address")
      .populate("createdBy", "name email");

    if (!plot) {
      return res.status(404).json({
        success: false,
        message: "Plot not found",
      });
    }

    res.status(200).json({
      success: true,
      data: plot,
    });
  } catch (error) {
    console.error("Get plot by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching plot",
      error: error.message,
    });
  }
};

// @desc    Create new plot
// @route   POST /api/plots
// @access  Private
exports.createPlot = async (req, res) => {
  try {
    const {
      plotNumber,
      project,
      block,
      phase,
      plotSize,
      unit,
      plotType,
      facing,
      basePrice,
      features,
      remarks,
    } = req.body;

    // Validation
    if (!plotNumber || !project || !plotSize || !plotType || !basePrice) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide plotNumber, project, plotSize, plotType, and basePrice",
      });
    }

    // Verify project exists
    const projectExists = await Project.findOne({
      _id: project,
      tenantId: req.tenantId,
    });
    if (!projectExists) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if plot number already exists
    const existingPlot = await Plot.findOne({
      tenantId: req.tenantId,
      plotNumber,
    });
    if (existingPlot) {
      return res.status(400).json({
        success: false,
        message: "Plot number already exists",
      });
    }

    // Create plot data
    const plotData = {
      tenantId: req.tenantId,
      plotNumber,
      project,
      block,
      phase,
      plotSize,
      unit: unit || "sq ft",
      plotType,
      facing,
      basePrice,
      rate: req.body.rate || basePrice,
      quantity: req.body.quantity || 1,
      totalStock: req.body.totalStock || 1,
      soldStock: 0,
      availableStock: req.body.totalStock || 1,
      grossAmount: req.body.grossAmount,
      paymentTerms: req.body.paymentTerms,
      features: features || [],
      remarks,
      status: "Available",
      createdBy: req.user._id,
    };

    const plot = await Plot.create(plotData);

    // Populate references
    await plot.populate("project", "name code");
    await plot.populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Plot created successfully",
      data: plot,
    });
  } catch (error) {
    console.error("Create plot error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating plot",
      error: error.message,
    });
  }
};

// @desc    Update plot
// @route   PUT /api/plots/:id
// @access  Private
exports.updatePlot = async (req, res) => {
  try {
    const plot = await Plot.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!plot) {
      return res.status(404).json({
        success: false,
        message: "Plot not found",
      });
    }

    const {
      plotNumber,
      block,
      phase,
      plotSize,
      unit,
      plotType,
      facing,
      status,
      basePrice,
      customer,
      bookingDate,
      saleDate,
      finalPrice,
      bookingAmount,
      amountReceived,
      registrationDate,
      possessionDate,
      features,
      remarks,
    } = req.body;

    // Track if customer or status is changing
    const isStatusChanging = status !== undefined && plot.status !== status;
    const isCustomerChanging =
      customer !== undefined && plot.customer?.toString() !== customer;

    // Update fields
    if (plotNumber !== undefined) plot.plotNumber = plotNumber;
    if (block !== undefined) plot.block = block;
    if (phase !== undefined) plot.phase = phase;
    if (plotSize !== undefined) plot.plotSize = plotSize;
    if (unit !== undefined) plot.unit = unit;
    if (plotType !== undefined) plot.plotType = plotType;
    if (facing !== undefined) plot.facing = facing;
    if (status !== undefined) plot.status = status;
    if (basePrice !== undefined) plot.basePrice = basePrice;
    if (customer !== undefined) plot.customer = customer;
    if (bookingDate !== undefined) plot.bookingDate = bookingDate;
    if (saleDate !== undefined) plot.saleDate = saleDate;
    if (finalPrice !== undefined) plot.finalPrice = finalPrice;
    if (bookingAmount !== undefined) plot.bookingAmount = bookingAmount;
    if (amountReceived !== undefined) plot.amountReceived = amountReceived;
    if (registrationDate !== undefined)
      plot.registrationDate = registrationDate;
    if (possessionDate !== undefined) plot.possessionDate = possessionDate;
    if (features !== undefined) plot.features = features;
    if (remarks !== undefined) plot.remarks = remarks;

    // Set createdBy for journal entry creation if booking/selling
    if (
      (isStatusChanging && (status === "Booked" || status === "Sold")) ||
      isCustomerChanging
    ) {
      plot.createdBy = req.user._id;
    }

    const { runInTransaction } = require("../services/transactionService");
    await runInTransaction(async (session) => {
      await plot.save({ session });
    });

    // Populate references
    await plot.populate("project", "name code");
    await plot.populate("customer", "name email phone");
    await plot.populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Plot updated successfully",
      data: plot,
    });
  } catch (error) {
    console.error("Update plot error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating plot",
      error: error.message,
    });
  }
};

// @desc    Delete plot (soft delete)
// @route   DELETE /api/plots/:id
// @access  Private
exports.deletePlot = async (req, res) => {
  try {
    const plot = await Plot.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!plot) {
      return res.status(404).json({
        success: false,
        message: "Plot not found",
      });
    }

    // Soft delete
    plot.isActive = false;
    await plot.save();

    res.status(200).json({
      success: true,
      message: "Plot deleted successfully",
    });
  } catch (error) {
    console.error("Delete plot error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting plot",
      error: error.message,
    });
  }
};

// @desc    Get plots by project
// @route   GET /api/plots/project/:projectId
// @access  Private
exports.getPlotsByProject = async (req, res) => {
  try {
    const plots = await Plot.find({
      tenantId: req.tenantId,
      project: req.params.projectId,
      isActive: true,
    })
      .populate("customer", "name email phone")
      .populate("createdBy", "name email")
      .sort({ plotNumber: 1 });

    res.status(200).json({
      success: true,
      count: plots.length,
      data: plots,
    });
  } catch (error) {
    console.error("Get plots by project error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching plots",
      error: error.message,
    });
  }
};

// @desc    Get plot summary/statistics
// @route   GET /api/plots/summary
// @access  Private
exports.getPlotSummary = async (req, res) => {
  try {
    const { project } = req.query;
    const filter = { tenantId: req.tenantId, isActive: true };
    if (project) filter.project = project;

    const plots = await Plot.find(filter);

    const summary = {
      total: plots.length,
      available: plots.filter((p) => p.status === "Available").length,
      booked: plots.filter((p) => p.status === "Booked").length,
      sold: plots.filter((p) => p.status === "Sold").length,
      underConstruction: plots.filter((p) => p.status === "Under Construction")
        .length,
      hold: plots.filter((p) => p.status === "Hold").length,
      totalValue: plots.reduce((sum, p) => sum + (p.basePrice || 0), 0),
      totalSalesValue: plots
        .filter((p) => p.status === "Sold")
        .reduce(
          (sum, p) => sum + (p.grossAmount || p.finalPrice || p.basePrice || 0),
          0
        ),
      totalReceived: plots
        .filter((p) => p.status === "Sold" || p.status === "Booked")
        .reduce((sum, p) => sum + (p.amountReceived || 0), 0),
      totalBalance: plots
        .filter((p) => p.status === "Sold" || p.status === "Booked")
        .reduce((sum, p) => sum + (p.balance || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get plot summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching plot summary",
      error: error.message,
    });
  }
};
