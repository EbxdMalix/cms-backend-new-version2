const express = require("express");
const router = express.Router();
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// @route   GET /api/notifications
// @desc    Get all notifications for logged-in user
router.get("/", getMyNotifications);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count
router.get("/unread-count", getUnreadCount);

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
router.put("/:id/read", markAsRead);

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
router.put("/mark-all-read", markAllAsRead);

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
router.delete("/:id", deleteNotification);

// @route   DELETE /api/notifications/read
// @desc    Delete all read notifications
router.delete("/read/all", deleteAllRead);

module.exports = router;
