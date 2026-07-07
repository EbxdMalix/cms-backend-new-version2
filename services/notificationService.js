const Notification = require("../models/Notification");
const User = require("../models/User");
const UserNotificationPreference = require("../models/UserNotificationPreference");
const { logAudit } = require("../utils/audit");

class NotificationService {
  static async create({ tenantId, recipient, sender, type, title, message, entityType, entityId, metadata, priority = "normal" }) {
    if (!tenantId || !recipient) {
      console.warn("NotificationService.create: tenantId and recipient are required");
      return null;
    }

    const prefs = await UserNotificationPreference.findOne({ userId: recipient, tenantId });
    if (prefs && prefs.preferences[type] === false) {
      return null;
    }

    if (entityId) {
      const recent = await Notification.findOne({
        tenantId, recipient, type, entityId,
        createdAt: { $gte: new Date(Date.now() - 5000) },
      }).sort({ createdAt: -1 });
      if (recent) {
        return recent;
      }
    }

    const notification = await Notification.create({
      tenantId, recipient, sender, type, title, message,
      entityType, entityId, metadata, priority,
    });

    logAudit({
      tenantId,
      userId: sender || recipient,
      action: "NOTIFICATION_SENT",
      entityType: "Notification",
      entityId: notification._id,
      metadata: { notificationType: type, recipient: recipient.toString(), title, priority },
    });

    return notification;
  }

  static async notifyAdmins({ tenantId, sender, type, title, message, entityType, entityId, metadata, priority = "normal" }) {
    if (!tenantId) {
      console.warn("NotificationService.notifyAdmins: tenantId is required");
      return [];
    }

    const admins = await User.find({ role: "admin", isActive: true });
    const results = [];
    for (const admin of admins) {
      const result = await this.create({
        tenantId, recipient: admin._id, sender, type, title, message,
        entityType, entityId, metadata, priority,
      });
      if (result) results.push(result);
    }
    return results;
  }

  static async notifyUser({ tenantId, recipient, sender, type, title, message, entityType, entityId, metadata, priority = "normal" }) {
    return this.create({
      tenantId, recipient, sender, type, title, message,
      entityType, entityId, metadata, priority,
    });
  }

  static async notifyUsersByRole({ tenantId, role, sender, type, title, message, entityType, entityId, metadata, priority = "normal" }) {
    if (!tenantId) {
      console.warn("NotificationService.notifyUsersByRole: tenantId is required");
      return [];
    }

    const users = await User.find({ role, isActive: true });
    const results = [];
    for (const user of users) {
      const result = await this.create({
        tenantId, recipient: user._id, sender, type, title, message,
        entityType, entityId, metadata, priority,
      });
      if (result) results.push(result);
    }
    return results;
  }
}

module.exports = NotificationService;
