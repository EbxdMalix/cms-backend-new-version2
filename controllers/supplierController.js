const Supplier = require("../models/Supplier");
const { notifyAdmins } = require("./notificationController");

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ tenantId: req.tenantId }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching suppliers",
      error: error.message,
    });
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
exports.getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching supplier",
      error: error.message,
    });
  }
};

// @desc    Create new supplier
// @route   POST /api/suppliers
// @access  Private
exports.createSupplier = async (req, res) => {
  try {
    const {
      code,
      name,
      email,
      phone,
      company,
      category,
      address,
      city,
      country,
      status,
    } = req.body;

    // Check if supplier code already exists
    const existingSupplier = await Supplier.findOne({
      tenantId: req.tenantId,
      code,
    });
    if (existingSupplier) {
      return res.status(400).json({
        success: false,
        message: "Supplier code already exists",
      });
    }

    const supplier = await Supplier.create({
      tenantId: req.tenantId,
      code,
      name,
      email,
      phone,
      company,
      category,
      address,
      city,
      country,
      status,
      createdBy: req.user._id,
    });

    notifyAdmins({
      tenantId: req.tenantId,
      sender: req.user._id,
      type: "supplier_created",
      title: "New Supplier Created",
      message: `Supplier ${supplier.name} created by ${req.user.name}`,
      entityType: "supplier",
      entityId: supplier._id,
      metadata: { supplierCode: supplier.code, supplierCompany: supplier.company },
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Supplier code already exists",
      });
    }

    res.status(400).json({
      success: false,
      message: "Error creating supplier",
      error: error.message,
    });
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private
exports.updateSupplier = async (req, res) => {
  try {
    const {
      code,
      name,
      email,
      phone,
      company,
      category,
      address,
      city,
      country,
      status,
    } = req.body;

    let supplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Check if new code conflicts with existing supplier
    if (code && code !== supplier.code) {
      const existingSupplier = await Supplier.findOne({
        tenantId: req.tenantId,
        code,
      });
      if (existingSupplier) {
        return res.status(400).json({
          success: false,
          message: "Supplier code already exists",
        });
      }
    }

    supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        code,
        name,
        email,
        phone,
        company,
        category,
        address,
        city,
        country,
        status,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating supplier",
      error: error.message,
    });
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Check for active transactions before deletion
    const Purchase = require("../models/Purchase");

    const purchaseCount = await Purchase.countDocuments({
      tenantId: req.tenantId,
      vendorName: supplier.name,
    });

    if (purchaseCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete supplier with existing purchase orders",
        details: {
          purchases: purchaseCount,
        },
      });
    }

    await Supplier.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting supplier",
      error: error.message,
    });
  }
};

// @desc    Get suppliers by category
// @route   GET /api/suppliers/category/:category
// @access  Private
exports.getSuppliersByCategory = async (req, res) => {
  try {
    const suppliers = await Supplier.find({
      tenantId: req.tenantId,
      category: req.params.category,
      status: "active",
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching suppliers by category",
      error: error.message,
    });
  }
};
