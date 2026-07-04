const Customer = require("../models/Customer");

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ tenantId: req.tenantId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error("Get all customers error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: error.message,
    });
  }
};

// @desc    Get single customer by ID
// @route   GET /api/customers/:id
// @access  Private
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Get customer by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customer",
      error: error.message,
    });
  }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res) => {
  try {
    const { code, name, email, phone, address, totalPurchase, balance } =
      req.body;

    // Validation
    if (!code || !name || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: code, name, email, phone, and address",
      });
    }

    // Check if customer code already exists
    const existingCustomer = await Customer.findOne({
      tenantId: req.tenantId,
      code: code.toUpperCase(),
    });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: "Customer with this code already exists",
      });
    }

    // Check if email already exists
    const existingEmail = await Customer.findOne({
      tenantId: req.tenantId,
      email,
    });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Customer with this email already exists",
      });
    }

    // Create customer data
    const customerData = {
      tenantId: req.tenantId,
      code: code.toUpperCase(),
      name,
      email,
      phone,
      address,
      totalPurchase: totalPurchase || 0,
      balance: balance || 0,
    };

    // Create new customer
    const customer = await Customer.create(customerData);

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating customer",
      error: error.message,
    });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res) => {
  try {
    const {
      code,
      name,
      email,
      phone,
      address,
      totalPurchase,
      balance,
      isActive,
    } = req.body;

    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Update fields
    if (code) {
      // Check if code is already taken by another customer
      const existingCustomer = await Customer.findOne({
        tenantId: req.tenantId,
        code: code.toUpperCase(),
      });
      if (
        existingCustomer &&
        existingCustomer._id.toString() !== req.params.id
      ) {
        return res.status(400).json({
          success: false,
          message: "Customer code is already in use",
        });
      }
      customer.code = code.toUpperCase();
    }

    if (name) customer.name = name;

    if (email) {
      // Check if email is already taken by another customer
      const existingEmail = await Customer.findOne({
        tenantId: req.tenantId,
        email,
      });
      if (existingEmail && existingEmail._id.toString() !== req.params.id) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use",
        });
      }
      customer.email = email;
    }

    if (phone) customer.phone = phone;
    if (address) customer.address = address;
    if (typeof totalPurchase === "number")
      customer.totalPurchase = totalPurchase;
    if (typeof balance === "number") customer.balance = balance;
    if (typeof isActive === "boolean") customer.isActive = isActive;

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating customer",
      error: error.message,
    });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check for active transactions before deletion
    const SalesInvoice = require("../models/SalesInvoice");

    const salesCount = await SalesInvoice.countDocuments({
      tenantId: req.tenantId,
      customer: req.params.id,
    });

    if (salesCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete customer with existing sales invoices",
        details: {
          salesInvoices: salesCount,
        },
      });
    }

    await Customer.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting customer",
      error: error.message,
    });
  }
};

// @desc    Get customer by code
// @route   GET /api/customers/code/:code
// @access  Private
exports.getCustomerByCode = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      tenantId: req.tenantId,
      code: req.params.code.toUpperCase(),
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Get customer by code error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customer",
      error: error.message,
    });
  }
};
