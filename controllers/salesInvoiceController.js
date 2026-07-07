const SalesInvoice = require("../models/SalesInvoice");
const Customer = require("../models/Customer");
const Plot = require("../models/Plot");
const Item = require("../models/Item");
const { notifyAdmins } = require("./notificationController");

// @desc    Get all sales invoices
// @route   GET /api/sales-invoices
// @access  Private
exports.getAllSalesInvoices = async (req, res) => {
  try {
    const salesInvoices = await SalesInvoice.find({ tenantId: req.tenantId })
      .populate("customer", "name code email phone address")
      .populate("employeeReference", "name email")
      .populate("project", "name code")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: salesInvoices.length,
      data: salesInvoices,
    });
  } catch (error) {
    console.error("Get all sales invoices error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales invoices",
      error: error.message,
    });
  }
};

// @desc    Get single sales invoice by ID
// @route   GET /api/sales-invoices/:id
// @access  Private
exports.getSalesInvoiceById = async (req, res) => {
  try {
    const salesInvoice = await SalesInvoice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate("customer", "name code email phone address")
      .populate("employeeReference", "name email")
      .populate("project", "name code estimatedCost");

    if (!salesInvoice) {
      return res.status(404).json({
        success: false,
        message: "Sales invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: salesInvoice,
    });
  } catch (error) {
    console.error("Get sales invoice by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales invoice",
      error: error.message,
    });
  }
};

// @desc    Create new sales invoice
// @route   POST /api/sales-invoices
// @access  Private
exports.createSalesInvoice = async (req, res) => {
  try {
    const {
      date,
      purchaseOrderNo,
      deliveryChallanNo,
      termsOfPayment,
      incomeAccount,
      customer,
      customerCode,
      customerName,
      address,
      telephone,
      items,
      inventoryLocation,
      project,
      jobNo,
      jobDescription,
      employeeReference,
      remarks,
      additionalDiscount,
      carriageFreight,
      amountReceived,
    } = req.body;

    // Validation
    if (
      !customer ||
      !customerCode ||
      !customerName ||
      !items ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide customer details and at least one item",
      });
    }

    // Verify customer exists
    const customerExists = await Customer.findOne({
      _id: customer,
      tenantId: req.tenantId,
    });
    if (!customerExists) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Verify project if provided
    if (project) {
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

    // Create sales invoice data
    const salesInvoiceData = {
      tenantId: req.tenantId,
      date: date || new Date(),
      purchaseOrderNo: purchaseOrderNo || "",
      deliveryChallanNo: deliveryChallanNo || "",
      termsOfPayment: termsOfPayment || "Cash",
      incomeAccount: incomeAccount || "",
      customer,
      customerCode: customerCode.toUpperCase(),
      customerName,
      address: address || "",
      telephone: telephone || "",
      items: items.map((item) => ({
        itemType: item.itemType || "Inventory",
        itemCode: item.itemCode.toUpperCase(),
        description: item.description || "",
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        grossAmount: item.grossAmount || item.quantity * item.rate,
        discountPercent: item.discountPercent || 0,
        discount: item.discount || 0,
        netAmount:
          item.netAmount || item.quantity * item.rate - (item.discount || 0),
        plot: item.plot || null,
        item: item.item || null,
      })),
      inventoryLocation: inventoryLocation || "",
      project: project || null,
      jobNo: jobNo || "",
      jobDescription: jobDescription || "",
      employeeReference: employeeReference || null,
      remarks: remarks || "",
      additionalDiscount: additionalDiscount || 0,
      carriageFreight: carriageFreight || 0,
      amountReceived: amountReceived || 0,
    };

    // Validate stock availability before creating invoice
    const stockValidation = [];
    for (const item of items) {
      if (item.itemType === "Plot") {
        // Validate plot stock
        const plotRecord = await Plot.findOne({
          plotNumber: item.itemCode.toUpperCase(),
          tenantId: req.tenantId,
        });
        if (plotRecord) {
          // For plots, check if it's already Sold
          // Allow selling if status is Available, Booked, Hold, or Under Construction
          const allowedStatuses = [
            "Available",
            "Booked",
            "Hold",
            "Under Construction",
          ];

          // Check if plot is already sold AND has no available stock
          if (plotRecord.status === "Sold" && plotRecord.availableStock === 0) {
            stockValidation.push({
              itemCode: item.itemCode,
              itemName: plotRecord.plotType + " Plot",
              requested: item.quantity,
              available: 0,
              type: "Plot",
              reason: "Plot is already sold and has no available stock",
            });
          } else if (
            plotRecord.status === "Sold" &&
            plotRecord.totalStock - plotRecord.soldStock < item.quantity
          ) {
            stockValidation.push({
              itemCode: item.itemCode,
              itemName: plotRecord.plotType + " Plot",
              requested: item.quantity,
              available: plotRecord.totalStock - plotRecord.soldStock,
              type: "Plot",
              reason: "Insufficient stock available",
            });
          } else if (
            !allowedStatuses.includes(plotRecord.status) &&
            plotRecord.status !== "Sold"
          ) {
            stockValidation.push({
              itemCode: item.itemCode,
              itemName: plotRecord.plotType + " Plot",
              requested: item.quantity,
              available: 0,
              type: "Plot",
              reason: `Plot status is ${plotRecord.status}`,
            });
          } else if (plotRecord.totalStock < item.quantity) {
            stockValidation.push({
              itemCode: item.itemCode,
              itemName: plotRecord.plotType + " Plot",
              requested: item.quantity,
              available: plotRecord.totalStock,
              type: "Plot",
              reason: "Requested quantity exceeds total stock",
            });
          }
        }
      } else {
        // Validate inventory item stock
        const itemRecord = await Item.findOne({
          itemCode: item.itemCode.toUpperCase(),
          tenantId: req.tenantId,
        });
        if (itemRecord) {
          const availableStock = itemRecord.currentStock || 0;
          if (availableStock < item.quantity) {
            stockValidation.push({
              itemCode: item.itemCode,
              itemName: itemRecord.name,
              requested: item.quantity,
              available: availableStock,
              type: "Inventory",
            });
          }
        }
      }
    }

    // If any items have insufficient stock, return error
    if (stockValidation.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock for one or more items",
        insufficientStock: stockValidation,
      });
    }

    const { runInTransaction } = require("../services/transactionService");

    let salesInvoice;
    await runInTransaction(async (session) => {
      // Create new sales invoice
      const createdInvoices = await SalesInvoice.create([salesInvoiceData], { session });
      salesInvoice = createdInvoices[0];

      // Deduct stock for all items in the invoice
      for (const item of salesInvoice.items) {
        if (item.itemType === "Plot") {
          // Update plot stock
          const plotRecord = await Plot.findOne({ plotNumber: item.itemCode, tenantId: req.tenantId }).session(session);
          if (plotRecord) {
            // Increment sold stock
            plotRecord.soldStock = (plotRecord.soldStock || 0) + item.quantity;
            // Calculate available stock
            plotRecord.availableStock =
              plotRecord.totalStock - plotRecord.soldStock;

            // If all stock is sold, mark as Sold and link customer
            if (plotRecord.availableStock === 0) {
              plotRecord.status = "Sold";
              plotRecord.customer = customer;
            }

            // Update amount received and balance
            plotRecord.amountReceived =
              (plotRecord.amountReceived || 0) + (amountReceived || 0);
            plotRecord.balance =
              plotRecord.grossAmount - plotRecord.amountReceived;

            await plotRecord.save({ session });
          }
        } else {
          // Update inventory item stock
          const itemRecord = await Item.findOne({ itemCode: item.itemCode, tenantId: req.tenantId }).session(session);
          if (itemRecord) {
            await Item.findByIdAndUpdate(itemRecord._id, {
              $inc: { currentStock: -item.quantity },
            }, { session });
          }
        }
      }

      // Update customer balance
      const netTotal = salesInvoice.netTotal;
      const balance = salesInvoice.balance;

      await Customer.findByIdAndUpdate(customer, {
        $inc: {
          totalPurchase: netTotal,
          balance: balance,
        },
      }, { session });
    });

    // Populate references before sending response
    await salesInvoice.populate("customer", "name code email phone address");
    await salesInvoice.populate("employeeReference", "name email");
    await salesInvoice.populate("project", "name code");

    notifyAdmins({
      tenantId: req.tenantId,
      sender: req.user._id,
      type: "sales_invoice_created",
      title: "New Sales Invoice",
      message: `Sales invoice ${salesInvoice.serialNo} created for ${salesInvoice.customerName} by ${req.user.name}`,
      entityType: "sales_invoice",
      entityId: salesInvoice._id,
      metadata: { serialNo: salesInvoice.serialNo, netTotal: salesInvoice.netTotal },
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({
      success: true,
      message: "Sales invoice created successfully",
      data: salesInvoice,
    });
  } catch (error) {
    console.error("Create sales invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating sales invoice",
      error: error.message,
    });
  }
};

// @desc    Update sales invoice
// @route   PUT /api/sales-invoices/:id
// @access  Private
exports.updateSalesInvoice = async (req, res) => {
  try {
    const salesInvoice = await SalesInvoice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!salesInvoice) {
      return res.status(404).json({
        success: false,
        message: "Sales invoice not found",
      });
    }

    // Store old values for customer balance adjustment and stock reversal
    const oldNetTotal = salesInvoice.netTotal;
    const oldBalance = salesInvoice.balance;
    const oldCustomer = salesInvoice.customer;
    const oldItems = [...salesInvoice.items];

    const {
      date,
      purchaseOrderNo,
      deliveryChallanNo,
      termsOfPayment,
      incomeAccount,
      customer,
      customerCode,
      customerName,
      address,
      telephone,
      items,
      inventoryLocation,
      project,
      jobNo,
      jobDescription,
      employeeReference,
      remarks,
      additionalDiscount,
      carriageFreight,
      amountReceived,
      status,
      isActive,
    } = req.body;

    // Update fields
    if (date) salesInvoice.date = date;
    if (purchaseOrderNo !== undefined)
      salesInvoice.purchaseOrderNo = purchaseOrderNo;
    if (deliveryChallanNo !== undefined)
      salesInvoice.deliveryChallanNo = deliveryChallanNo;
    if (termsOfPayment) salesInvoice.termsOfPayment = termsOfPayment;
    if (incomeAccount !== undefined) salesInvoice.incomeAccount = incomeAccount;

    // Verify customer if being updated
    if (customer && customer !== oldCustomer.toString()) {
      const customerExists = await Customer.findOne({
        _id: customer,
        tenantId: req.tenantId,
      });
      if (!customerExists) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }
      salesInvoice.customer = customer;
    }

    if (customerCode) salesInvoice.customerCode = customerCode.toUpperCase();
    if (customerName) salesInvoice.customerName = customerName;
    if (address !== undefined) salesInvoice.address = address;
    if (telephone !== undefined) salesInvoice.telephone = telephone;

    // Handle item changes with stock adjustment
    if (items && items.length > 0) {
      // First, restore stock for old items
      for (const oldItem of oldItems) {
        if (oldItem.itemType === "Plot") {
          const plotRecord = await Plot.findOne({
            plotNumber: oldItem.itemCode,
            tenantId: req.tenantId,
          });
          if (plotRecord) {
            // Restore sold stock
            plotRecord.soldStock = Math.max(
              0,
              (plotRecord.soldStock || 0) - oldItem.quantity
            );
            plotRecord.availableStock =
              plotRecord.totalStock - plotRecord.soldStock;

            // If stock becomes available, change status
            if (plotRecord.availableStock > 0 && plotRecord.status === "Sold") {
              plotRecord.status = "Available";
              plotRecord.customer = null;
            }

            await plotRecord.save();
          }
        } else {
          const itemRecord = await Item.findOne({ itemCode: oldItem.itemCode, tenantId: req.tenantId });
          if (itemRecord) {
            await Item.findByIdAndUpdate(itemRecord._id, {
              $inc: { currentStock: oldItem.quantity },
            });
          }
        }
      }

      // Validate stock availability for new items
      const stockValidation = [];
      for (const item of items) {
        if (item.itemType === "Plot") {
          const plotRecord = await Plot.findOne({
            plotNumber: item.itemCode.toUpperCase(),
            tenantId: req.tenantId,
          });
          if (plotRecord) {
            // For plots, check if it's already Sold AND has no available stock
            const allowedStatuses = [
              "Available",
              "Booked",
              "Hold",
              "Under Construction",
            ];

            // Check if plot is sold with no stock available
            if (
              plotRecord.status === "Sold" &&
              plotRecord.availableStock === 0
            ) {
              stockValidation.push({
                itemCode: item.itemCode,
                itemName: plotRecord.plotType + " Plot",
                requested: item.quantity,
                available: 0,
                type: "Plot",
                reason: "Plot is already sold",
              });
            } else if (
              plotRecord.status === "Sold" &&
              plotRecord.totalStock - plotRecord.soldStock < item.quantity
            ) {
              // If status is Sold but has some stock, check calculated available stock
              stockValidation.push({
                itemCode: item.itemCode,
                itemName: plotRecord.plotType + " Plot",
                requested: item.quantity,
                available: plotRecord.totalStock - plotRecord.soldStock,
                type: "Plot",
                reason: "Insufficient available stock",
              });
            } else if (
              plotRecord.status !== "Sold" &&
              !allowedStatuses.includes(plotRecord.status)
            ) {
              stockValidation.push({
                itemCode: item.itemCode,
                itemName: plotRecord.plotType + " Plot",
                requested: item.quantity,
                available: 0,
                type: "Plot",
                reason: `Plot status is ${plotRecord.status}`,
              });
            } else if (plotRecord.totalStock < item.quantity) {
              stockValidation.push({
                itemCode: item.itemCode,
                itemName: plotRecord.plotType + " Plot",
                requested: item.quantity,
                available: plotRecord.totalStock,
                type: "Plot",
                reason: "Requested quantity exceeds total stock",
              });
            }
          }
        } else {
          const itemRecord = await Item.findOne({
            itemCode: item.itemCode.toUpperCase(),
            tenantId: req.tenantId,
          });
          if (itemRecord) {
            const availableStock = itemRecord.currentStock || 0;
            if (availableStock < item.quantity) {
              stockValidation.push({
                itemCode: item.itemCode,
                itemName: itemRecord.name,
                requested: item.quantity,
                available: availableStock,
                type: "Inventory",
              });
            }
          }
        }
      }

      // If insufficient stock, restore old items and return error
      if (stockValidation.length > 0) {
        // Restore old stock state
        for (const oldItem of oldItems) {
          if (oldItem.itemType === "Plot") {
          const plotRecord = await Plot.findOne({
            plotNumber: oldItem.itemCode,
            tenantId: req.tenantId,
          });
          if (plotRecord) {
            // Restore sold stock
            plotRecord.soldStock =
                (plotRecord.soldStock || 0) + oldItem.quantity;
              plotRecord.availableStock =
                plotRecord.totalStock - plotRecord.soldStock;

              // Restore status if it was sold
              if (plotRecord.availableStock === 0) {
                plotRecord.status = "Sold";
                plotRecord.customer = oldCustomer;
              }

              await plotRecord.save();
            }
          } else {
          const itemRecord = await Item.findOne({
            itemCode: oldItem.itemCode,
            tenantId: req.tenantId,
          });
          if (itemRecord) {
            await Item.findByIdAndUpdate(itemRecord._id, {
              $inc: { currentStock: -oldItem.quantity },
            });
          }
          }
        }

        return res.status(400).json({
          success: false,
          message: "Insufficient stock for one or more items",
          insufficientStock: stockValidation,
        });
      }

      // Deduct stock for new items
      for (const item of items) {
        if (item.itemType === "Plot") {
          const plotRecord = await Plot.findOne({
            plotNumber: item.itemCode.toUpperCase(),
            tenantId: req.tenantId,
          });
          if (plotRecord) {
            // Increment sold stock
            plotRecord.soldStock = (plotRecord.soldStock || 0) + item.quantity;
            plotRecord.availableStock =
              plotRecord.totalStock - plotRecord.soldStock;

            // If all stock sold, mark as Sold and link customer
            if (plotRecord.availableStock === 0) {
              plotRecord.status = "Sold";
              plotRecord.customer = customer || salesInvoice.customer;
            }

            // Update amount received
            const newAmountReceived =
              amountReceived !== undefined
                ? amountReceived
                : salesInvoice.amountReceived;
            plotRecord.amountReceived =
              (plotRecord.amountReceived || 0) + newAmountReceived;
            plotRecord.balance =
              plotRecord.grossAmount - plotRecord.amountReceived;

            await plotRecord.save();
          }
        } else {
          const itemRecord = await Item.findOne({
            itemCode: item.itemCode.toUpperCase(),
            tenantId: req.tenantId,
          });
          if (itemRecord) {
            await Item.findByIdAndUpdate(itemRecord._id, {
              $inc: { currentStock: -item.quantity },
            });
          }
        }
      }

      salesInvoice.items = items.map((item) => ({
        itemType: item.itemType || "Inventory",
        itemCode: item.itemCode.toUpperCase(),
        description: item.description || "",
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        grossAmount: item.grossAmount || item.quantity * item.rate,
        discountPercent: item.discountPercent || 0,
        discount: item.discount || 0,
        netAmount:
          item.netAmount || item.quantity * item.rate - (item.discount || 0),
        plot: item.plot || null,
        item: item.item || null,
      }));
    }

    if (inventoryLocation !== undefined)
      salesInvoice.inventoryLocation = inventoryLocation;
    if (project !== undefined) salesInvoice.project = project;
    if (jobNo !== undefined) salesInvoice.jobNo = jobNo;
    if (jobDescription !== undefined)
      salesInvoice.jobDescription = jobDescription;
    if (employeeReference !== undefined)
      salesInvoice.employeeReference = employeeReference;
    if (remarks !== undefined) salesInvoice.remarks = remarks;
    if (typeof additionalDiscount === "number")
      salesInvoice.additionalDiscount = additionalDiscount;
    if (typeof carriageFreight === "number")
      salesInvoice.carriageFreight = carriageFreight;
    if (typeof amountReceived === "number")
      salesInvoice.amountReceived = amountReceived;
    if (status) salesInvoice.status = status;
    if (typeof isActive === "boolean") salesInvoice.isActive = isActive;

    await salesInvoice.save();

    // Update customer balance (remove old values, add new values)
    const newNetTotal = salesInvoice.netTotal;
    const newBalance = salesInvoice.balance;

    // If customer changed
    if (customer && customer !== oldCustomer.toString()) {
      // Decrease old customer balance
      await Customer.findByIdAndUpdate(oldCustomer, {
        $inc: {
          totalPurchase: -oldNetTotal,
          balance: -oldBalance,
        },
      });

      // Increase new customer balance
      await Customer.findByIdAndUpdate(customer, {
        $inc: {
          totalPurchase: newNetTotal,
          balance: newBalance,
        },
      });
    } else {
      // Same customer, just update the difference
      const netTotalDiff = newNetTotal - oldNetTotal;
      const balanceDiff = newBalance - oldBalance;

      await Customer.findByIdAndUpdate(oldCustomer, {
        $inc: {
          totalPurchase: netTotalDiff,
          balance: balanceDiff,
        },
      });
    }

    // Populate references before sending response
    await salesInvoice.populate("customer", "name code email phone address");
    await salesInvoice.populate("employeeReference", "name email");
    await salesInvoice.populate("project", "name code");

    res.status(200).json({
      success: true,
      message: "Sales invoice updated successfully",
      data: salesInvoice,
    });
  } catch (error) {
    console.error("Update sales invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating sales invoice",
      error: error.message,
    });
  }
};

// @desc    Delete sales invoice
// @route   DELETE /api/sales-invoices/:id
// @access  Private
exports.deleteSalesInvoice = async (req, res) => {
  try {
    const salesInvoice = await SalesInvoice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!salesInvoice) {
      return res.status(404).json({
        success: false,
        message: "Sales invoice not found",
      });
    }

    // Restore stock for all items in the invoice (reverse the sale)
    for (const item of salesInvoice.items) {
      if (item.itemType === "Plot") {
        const plotRecord = await Plot.findOne({ plotNumber: item.itemCode, tenantId: req.tenantId });
        if (plotRecord) {
          // Decrement sold stock
          plotRecord.soldStock = Math.max(
            0,
            (plotRecord.soldStock || 0) - item.quantity
          );
          // Recalculate available stock
          plotRecord.availableStock =
            plotRecord.totalStock - plotRecord.soldStock;

          // If stock becomes available again, change status back to Available
          if (plotRecord.availableStock > 0 && plotRecord.status === "Sold") {
            plotRecord.status = "Available";
            plotRecord.customer = null; // Remove customer link
          }

          // Adjust amount received and balance
          plotRecord.amountReceived = Math.max(
            0,
            (plotRecord.amountReceived || 0) -
              (salesInvoice.amountReceived || 0)
          );
          plotRecord.balance =
            plotRecord.grossAmount - plotRecord.amountReceived;

          await plotRecord.save();
        }
      } else {
        const itemRecord = await Item.findOne({ itemCode: item.itemCode, tenantId: req.tenantId });
        if (itemRecord) {
          await Item.findByIdAndUpdate(itemRecord._id, {
            $inc: { currentStock: item.quantity },
          });
        }
      }
    }

    // Update customer balance (subtract invoice amounts)
    await Customer.findByIdAndUpdate(salesInvoice.customer, {
      $inc: {
        totalPurchase: -salesInvoice.netTotal,
        balance: -salesInvoice.balance,
      },
    });

    await SalesInvoice.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    res.status(200).json({
      success: true,
      message: "Sales invoice deleted successfully",
    });
  } catch (error) {
    console.error("Delete sales invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting sales invoice",
      error: error.message,
    });
  }
};

// @desc    Get sales invoices by customer
// @route   GET /api/sales-invoices/customer/:customerId
// @access  Private
exports.getSalesInvoicesByCustomer = async (req, res) => {
  try {
    const salesInvoices = await SalesInvoice.find({
      customer: req.params.customerId,
      tenantId: req.tenantId,
    })
      .populate("customer", "name code email phone address")
      .populate("project", "name code")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: salesInvoices.length,
      data: salesInvoices,
    });
  } catch (error) {
    console.error("Get sales invoices by customer error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales invoices",
      error: error.message,
    });
  }
};

// @desc    Get sales invoices by project
// @route   GET /api/sales-invoices/project/:projectId
// @access  Private
exports.getSalesInvoicesByProject = async (req, res) => {
  try {
    const salesInvoices = await SalesInvoice.find({
      project: req.params.projectId,
      tenantId: req.tenantId,
    })
      .populate("customer", "name code email phone address")
      .populate("project", "name code")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: salesInvoices.length,
      data: salesInvoices,
    });
  } catch (error) {
    console.error("Get sales invoices by project error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales invoices",
      error: error.message,
    });
  }
};

// @desc    Get sales invoices by date range
// @route   GET /api/sales-invoices/daterange?startDate=&endDate=
// @access  Private
exports.getSalesInvoicesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide both startDate and endDate",
      });
    }

    const salesInvoices = await SalesInvoice.find({
      tenantId: req.tenantId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .populate("customer", "name code email phone address")
      .populate("employeeReference", "name email")
      .populate("project", "name code")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: salesInvoices.length,
      data: salesInvoices,
    });
  } catch (error) {
    console.error("Get sales invoices by date range error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales invoices",
      error: error.message,
    });
  }
};
