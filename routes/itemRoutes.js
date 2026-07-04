const express = require("express");
const router = express.Router();
const {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getItemByCode,
  getItemsByCategory,
  getItemsBySubCategory,
  syncItemStock,
} = require("../controllers/itemController");
const { protect } = require("../middleware/authMiddleware");

// All routes are protected
router.use(protect);

// @route   GET /api/items
// @desc    Get all items (for dropdown selection)
router.get("/", getAllItems);

const PERMISSIONS = require("../constants/permissions");
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.ITEMS));

// @route   POST /api/items/sync-stock
// @desc    Sync currentStock with quantity for items
router.post("/sync-stock", syncItemStock);

// @route   GET /api/items/code/:code
// @desc    Get item by code
router.get("/code/:code", getItemByCode);

// @route   GET /api/items/category/:categoryCode
// @desc    Get items by category
router.get("/category/:categoryCode", getItemsByCategory);

// @route   GET /api/items/subcategory/:subCategoryCode
// @desc    Get items by subcategory
router.get("/subcategory/:subCategoryCode", getItemsBySubCategory);

// @route   GET /api/items/:id
// @desc    Get single item by ID
router.get("/:id", getItemById);

// @route   POST /api/items
// @desc    Create new item
router.post("/", createItem);

// @route   PUT /api/items/:id
// @desc    Update item
router.put("/:id", updateItem);

// @route   DELETE /api/items/:id
// @desc    Delete item
router.delete("/:id", deleteItem);

module.exports = router;
