const Purchase = require("../models/Purchase");
const Item = require("../models/Item");
const { notifyAdmins } = require("./notificationController");
const User = require("../models/User");

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private
exports.getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ tenantId: req.tenantId })
      .populate("item", "name itemCode measurement")
      .populate("employeeReference", "name email")
      .populate("project", "name code")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error("Get all purchases error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchases",
      error: error.message,
    });
  }
};

// @desc    Get single purchase by ID
// @route   GET /api/purchases/:id
// @access  Private
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate("item", "name itemCode measurement categoryName")
      .populate("employeeReference", "name email")
      .populate("project", "name code");

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error("Get purchase by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchase",
      error: error.message,
    });
  }
};

// @desc    Create new purchase
// @route   POST /api/purchases
// @access  Private
exports.createPurchase = async (req, res) => {
  try {
    const {
      serialNo,
      date,
      purchaseOrderNo,
      vendorInvoiceNo,
      vendorCode,
      vendorName,
      vendorAddress,
      vendorPhone,
      inventoryLocation,
      employeeReference,
      item,
      itemCode,
      itemName,
      description,
      quantity,
      unit,
      rate,
      grossAmount,
      discount,
      netAmount,
      project,
    } = req.body;

    // Validation
    if (
      !serialNo ||
      !date ||
      !purchaseOrderNo ||
      !vendorInvoiceNo ||
      !vendorName ||
      !item ||
      !itemCode ||
      !itemName ||
      !quantity ||
      !unit ||
      !rate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Verify item exists
    const itemExists = await Item.findOne({
      _id: item,
      tenantId: req.tenantId,
    });
    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Item not found in inventory",
      });
    }

    // Verify employee reference if provided
    if (employeeReference) {
      const userExists = await User.findOne({
        _id: employeeReference,
        tenantId: req.tenantId,
      });
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: "Employee reference not found",
        });
      }
    }

    // Create purchase data
    const purchaseData = {
      tenantId: req.tenantId,
      serialNo: serialNo.toUpperCase(),
      date,
      purchaseOrderNo,
      vendorInvoiceNo,
      vendorCode: vendorCode ? vendorCode.toUpperCase() : "",
      vendorName,
      vendorAddress: vendorAddress || "",
      vendorPhone: vendorPhone || "",
      inventoryLocation: inventoryLocation || "",
      employeeReference: employeeReference || null,
      item,
      itemCode: itemCode.toUpperCase(),
      itemName,
      description: description || "",
      quantity,
      unit,
      rate,
      grossAmount: grossAmount || quantity * rate,
      discount: discount || 0,
      netAmount: netAmount || quantity * rate - (discount || 0),
      project: project || null,
      createdBy: req.user ? req.user._id : null,
    };

    const { runInTransaction } = require("../services/transactionService");

    let purchase;
    await runInTransaction(async (session) => {
      // Create new purchase
      const createdPurchases = await Purchase.create([purchaseData], { session });
      purchase = createdPurchases[0];

      // Update item stock - increment currentStock by purchased quantity
      await Item.findByIdAndUpdate(item, {
        $inc: { currentStock: quantity },
      }, { session });

      // Update supplier balance (add to payables)
      if (vendorCode) {
        const Supplier = require("../models/Supplier");
        await Supplier.findOneAndUpdate(
          { code: vendorCode, tenantId: req.tenantId },
          {
            $inc: {
              totalPurchases: purchaseData.netAmount,
              balance: purchaseData.netAmount,
            },
          },
          { session }
        );
      }
    });

    // Populate references before sending response
    await purchase.populate("item", "name itemCode measurement");
    await purchase.populate("employeeReference", "name email");

    notifyAdmins({
      tenantId: req.tenantId,
      sender: req.user._id,
      type: "purchase_entry_created",
      title: "New Purchase Entry",
      message: `Purchase ${purchase.purchaseOrderNo} created for ${purchase.vendorName} by ${req.user.name}`,
      entityType: "purchase_entry",
      entityId: purchase._id,
      metadata: { purchaseOrderNo: purchase.purchaseOrderNo, netAmount: purchase.netAmount },
      priority: "high",
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: purchase,
    });
  } catch (error) {
    console.error("Create purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating purchase",
      error: error.message,
    });
  }
};

// @desc    Update purchase
// @route   PUT /api/purchases/:id
// @access  Private
exports.updatePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const {
      serialNo,
      date,
      purchaseOrderNo,
      vendorInvoiceNo,
      vendorCode,
      vendorName,
      vendorAddress,
      vendorPhone,
      inventoryLocation,
      jobNo,
      employeeReference,
      item,
      itemCode,
      itemName,
      description,
      quantity,
      unit,
      rate,
      grossAmount,
      discount,
      netAmount,
      project,
      status,
      isActive,
    } = req.body;

    // Update fields
    if (serialNo) purchase.serialNo = serialNo.toUpperCase();
    if (date) purchase.date = date;
    if (purchaseOrderNo) purchase.purchaseOrderNo = purchaseOrderNo;
    if (vendorInvoiceNo) purchase.vendorInvoiceNo = vendorInvoiceNo;
    if (vendorCode !== undefined)
      purchase.vendorCode = vendorCode ? vendorCode.toUpperCase() : "";
    if (vendorName) purchase.vendorName = vendorName;
    if (vendorAddress !== undefined) purchase.vendorAddress = vendorAddress;
    if (vendorPhone !== undefined) purchase.vendorPhone = vendorPhone;
    if (inventoryLocation !== undefined)
      purchase.inventoryLocation = inventoryLocation;
    if (jobNo !== undefined) purchase.jobNo = jobNo;
    if (employeeReference !== undefined)
      purchase.employeeReference = employeeReference;

    // Verify item if being updated
    if (item) {
      const itemExists = await Item.findOne({
        _id: item,
        tenantId: req.tenantId,
      });
      if (!itemExists) {
        return res.status(404).json({
          success: false,
          message: "Item not found in inventory",
        });
      }
      purchase.item = item;
    }

    if (itemCode) purchase.itemCode = itemCode.toUpperCase();
    if (itemName) purchase.itemName = itemName;
    if (description !== undefined) purchase.description = description;

    // Handle quantity update with stock adjustment
    if (typeof quantity === "number" && quantity !== purchase.quantity) {
      const quantityDiff = quantity - purchase.quantity;
      // Update item stock based on quantity difference
      await Item.findByIdAndUpdate(purchase.item, {
        $inc: { currentStock: quantityDiff },
      });
      purchase.quantity = quantity;
    }

    if (unit) purchase.unit = unit;
    if (typeof rate === "number") purchase.rate = rate;
    if (typeof grossAmount === "number") purchase.grossAmount = grossAmount;
    if (typeof discount === "number") purchase.discount = discount;
    if (typeof netAmount === "number") purchase.netAmount = netAmount;
    if (project !== undefined) purchase.project = project;
    if (status) purchase.status = status;
    if (typeof isActive === "boolean") purchase.isActive = isActive;

    await purchase.save();

    // Populate references before sending response
    await purchase.populate("item", "name itemCode measurement");
    await purchase.populate("employeeReference", "name email");

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: purchase,
    });
  } catch (error) {
    console.error("Update purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating purchase",
      error: error.message,
    });
  }
};

// @desc    Delete purchase
// @route   DELETE /api/purchases/:id
// @access  Private
exports.deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Decrement item stock by purchased quantity (reversing the purchase)
    await Item.findByIdAndUpdate(purchase.item, {
      $inc: { currentStock: -purchase.quantity },
    });

    await Purchase.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    console.error("Delete purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting purchase",
      error: error.message,
    });
  }
};

// @desc    Get purchases by vendor
// @route   GET /api/purchases/vendor/:vendorName
// @access  Private
exports.getPurchasesByVendor = async (req, res) => {
  try {
    const purchases = await Purchase.find({
      tenantId: req.tenantId,
      vendorName: new RegExp(req.params.vendorName, "i"),
    })
      .populate("item", "name itemCode measurement")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error("Get purchases by vendor error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchases",
      error: error.message,
    });
  }
};

// @desc    Get purchases by date range
// @route   GET /api/purchases/daterange?startDate=&endDate=
// @access  Private
exports.getPurchasesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide both startDate and endDate",
      });
    }

    const purchases = await Purchase.find({
      tenantId: req.tenantId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .populate("item", "name itemCode measurement")
      .populate("employeeReference", "name email")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error("Get purchases by date range error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchases",
      error: error.message,
    });
  }
};
