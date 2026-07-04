const Item = require("../models/Item");

// @desc    Get all items
// @route   GET /api/items
// @access  Private
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.find({ tenantId: req.tenantId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get all items error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: error.message,
    });
  }
};

// @desc    Get single item by ID
// @route   GET /api/items/:id
// @access  Private
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Get item by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching item",
      error: error.message,
    });
  }
};

// @desc    Create new item
// @route   POST /api/items
// @access  Private
exports.createItem = async (req, res) => {
  try {
    const {
      categoryCode,
      categoryName,
      subCategoryCode,
      subCategoryName,
      itemCode,
      name,
      description,
      brand,
      measurement,
      purchasePrice,
      saleTaxRate,
      quantity,
      sellingPrice,
      currentStock,
      minStockLevel,
    } = req.body;

    // Validation
    if (!itemCode || !name || !measurement) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: itemCode, name, and measurement",
      });
    }

    // Check if item code already exists
    const existingItem = await Item.findOne({
      tenantId: req.tenantId,
      itemCode: itemCode.toUpperCase(),
    });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Item with this code already exists",
      });
    }

    // Create item data
    const itemData = {
      tenantId: req.tenantId,
      categoryCode: categoryCode.toUpperCase(),
      categoryName,
      subCategoryCode: subCategoryCode ? subCategoryCode.toUpperCase() : "",
      subCategoryName: subCategoryName || "",
      itemCode: itemCode.toUpperCase(),
      name,
      description: description || "",
      brand: brand || "",
      measurement,
      purchasePrice: purchasePrice || 0,
      saleTaxRate: saleTaxRate || 0,
      quantity: quantity || 0,
      sellingPrice: sellingPrice || 0,
      minStockLevel: minStockLevel || 0,
    };

    // Only set currentStock if explicitly provided, otherwise let pre-save hook handle it
    if (typeof currentStock === "number") {
      itemData.currentStock = currentStock;
    }

    // Create new item
    const item = await Item.create(itemData);

    res.status(201).json({
      success: true,
      message: "Item created successfully",
      data: item,
    });
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating item",
      error: error.message,
    });
  }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private
exports.updateItem = async (req, res) => {
  try {
    const {
      categoryCode,
      categoryName,
      subCategoryCode,
      subCategoryName,
      itemCode,
      name,
      description,
      brand,
      measurement,
      purchasePrice,
      saleTaxRate,
      quantity,
      sellingPrice,
      currentStock,
      minStockLevel,
      isActive,
    } = req.body;

    const item = await Item.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Update fields
    if (categoryCode) item.categoryCode = categoryCode.toUpperCase();
    if (categoryName) item.categoryName = categoryName;
    if (subCategoryCode !== undefined)
      item.subCategoryCode = subCategoryCode
        ? subCategoryCode.toUpperCase()
        : "";
    if (subCategoryName !== undefined)
      item.subCategoryName = subCategoryName || "";

    if (itemCode) {
      // Check if item code is already taken by another item
      const existingItem = await Item.findOne({
        tenantId: req.tenantId,
        itemCode: itemCode.toUpperCase(),
      });
      if (existingItem && existingItem._id.toString() !== req.params.id) {
        return res.status(400).json({
          success: false,
          message: "Item code is already in use",
        });
      }
      item.itemCode = itemCode.toUpperCase();
    }

    if (name) item.name = name;
    if (description !== undefined) item.description = description;
    if (brand !== undefined) item.brand = brand;
    if (measurement) item.measurement = measurement;

    if (typeof purchasePrice === "number") item.purchasePrice = purchasePrice;
    if (typeof saleTaxRate === "number") item.saleTaxRate = saleTaxRate;
    if (typeof quantity === "number") item.quantity = quantity;
    if (typeof sellingPrice === "number") item.sellingPrice = sellingPrice;
    if (typeof currentStock === "number") item.currentStock = currentStock;
    if (typeof minStockLevel === "number") item.minStockLevel = minStockLevel;
    if (typeof isActive === "boolean") item.isActive = isActive;

    await item.save();

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: item,
    });
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating item",
      error: error.message,
    });
  }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Check for active transactions before deletion
    const Purchase = require("../models/Purchase");
    const SalesInvoice = require("../models/SalesInvoice");

    const purchaseCount = await Purchase.countDocuments({
      tenantId: req.tenantId,
      item: req.params.id,
    });
    const salesCount = await SalesInvoice.countDocuments({
      tenantId: req.tenantId,
      "items.itemCode": item.itemCode,
    });

    if (purchaseCount > 0 || salesCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete item with existing transactions",
        details: {
          purchases: purchaseCount,
          salesInvoices: salesCount,
        },
      });
    }

    await Item.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting item",
      error: error.message,
    });
  }
};

// @desc    Get item by code
// @route   GET /api/items/code/:code
// @access  Private
exports.getItemByCode = async (req, res) => {
  try {
    const item = await Item.findOne({
      tenantId: req.tenantId,
      itemCode: req.params.code.toUpperCase(),
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Get item by code error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching item",
      error: error.message,
    });
  }
};

// @desc    Get items by category
// @route   GET /api/items/category/:categoryCode
// @access  Private
exports.getItemsByCategory = async (req, res) => {
  try {
    const items = await Item.find({
      tenantId: req.tenantId,
      categoryCode: req.params.categoryCode.toUpperCase(),
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get items by category error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: error.message,
    });
  }
};

// @desc    Get items by subcategory
// @route   GET /api/items/subcategory/:subCategoryCode
// @access  Private
exports.getItemsBySubCategory = async (req, res) => {
  try {
    const items = await Item.find({
      tenantId: req.tenantId,
      subCategoryCode: req.params.subCategoryCode.toUpperCase(),
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get items by subcategory error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: error.message,
    });
  }
};

// @desc    Sync currentStock with quantity for items where currentStock is 0
// @route   POST /api/items/sync-stock
// @access  Private (Admin only)
exports.syncItemStock = async (req, res) => {
  try {
    // Find all items where currentStock is 0 but quantity > 0
    const result = await Item.updateMany(
      {
        tenantId: req.tenantId,
        currentStock: 0,
        quantity: { $gt: 0 },
      },
      [
        {
          $set: {
            currentStock: "$quantity",
          },
        },
      ]
    );

    res.status(200).json({
      success: true,
      message: "Stock synchronized successfully",
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Sync item stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error synchronizing stock",
      error: error.message,
    });
  }
};
