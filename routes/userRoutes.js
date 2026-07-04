const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

// @route   GET /api/users
// @desc    Get all users (for dropdowns - all authenticated users can access)
router.get("/", protect, getAllUsers);

// Admin-only routes
router.use(protect);
const PERMISSIONS = require("../constants/permissions");
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.USERS));

// @route   GET /api/users/:id
// @desc    Get single user by ID
router.get("/:id", getUserById);

// @route   POST /api/users
// @desc    Create new user
router.post("/", createUser);

// @route   PUT /api/users/:id
// @desc    Update user
router.put("/:id", updateUser);

// @route   DELETE /api/users/:id
// @desc    Delete user
router.delete("/:id", deleteUser);

// @route   PATCH /api/users/:id/toggle-status
// @desc    Toggle user status
router.patch("/:id/toggle-status", toggleUserStatus);

module.exports = router;
