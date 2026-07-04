const Notification = require("../models/Notification");
const User = require("../models/User");

// Get all notifications for logged-in user
exports.getMyNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({
      tenantId: req.tenantId,
      recipient: req.user.id,
    })
      .populate("sender", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({
      tenantId: req.tenantId,
      recipient: req.user.id,
    });
    const unreadCount = await Notification.countDocuments({
      tenantId: req.tenantId,
      recipient: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalNotifications: total,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch notifications",
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      tenantId: req.tenantId,
      recipient: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch unread count",
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, recipient: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    ).populate("sender", "name email role");

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { tenantId: req.tenantId, recipient: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark all notifications as read",
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
      recipient: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
};

// Delete all read notifications
exports.deleteAllRead = async (req, res) => {
  try {
    await Notification.deleteMany({
      tenantId: req.tenantId,
      recipient: req.user.id,
      isRead: true,
    });

    res.status(200).json({
      success: true,
      message: "All read notifications deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting read notifications:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete read notifications",
    });
  }
};

// Create notification (helper function for other controllers)
exports.createNotification = async (notificationData) => {
  try {
    const notification = await Notification.create(notificationData);
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Create notification for all admins
exports.notifyAdmins = async (notificationData) => {
  try {
    const admins = await User.find({ role: "admin", isActive: true });

    const notifications = admins.map((admin) => ({
      ...notificationData,
      recipient: admin._id,
    }));

    await Notification.insertMany(notifications);
    return notifications;
  } catch (error) {
    console.error("Error notifying admins:", error);
    throw error;
  }
};
