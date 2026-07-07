const SystemAlert = require("../models/SystemAlert");
const { logAudit } = require("../utils/audit");

class SystemAlertService {
  static async create({ tenantId, severity = "error", type, fingerprint, title, message, stackTrace, endpoint, method, userId, ipAddress, userAgent, metadata = {} }) {
    if (!type || !title) {
      console.warn("SystemAlertService.create: type and title are required");
      return null;
    }

    if (fingerprint) {
      const existing = await SystemAlert.findOne({
        fingerprint,
        resolved: false,
        createdAt: { $gte: new Date(Date.now() - 600000) },
      }).sort({ createdAt: -1 });

      if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.message = message;
        existing.lastSeen = new Date();
        await existing.save();
        return existing;
      }
    }

    const alert = await SystemAlert.create({
      tenantId, severity, type, fingerprint, title, message,
      stackTrace, endpoint, method, userId, ipAddress, userAgent, metadata,
    });

    logAudit({
      tenantId: tenantId || "system",
      userId: userId || "system",
      action: "SYSTEM_ALERT_CREATED",
      entityType: "SystemAlert",
      entityId: alert._id,
      metadata: { severity, type, title, fingerprint, endpoint },
    });

    if (severity === "critical") {
      this._notifyAdmins(alert).catch(err =>
        console.error("SystemAlert admin notify error:", err)
      );
    }

    return alert;
  }

  static async resolve(alertId, resolvedBy) {
    const alert = await SystemAlert.findById(alertId);
    if (!alert) return null;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;
    await alert.save();

    logAudit({
      tenantId: alert.tenantId || "system",
      userId: resolvedBy || "system",
      action: "SYSTEM_ALERT_RESOLVED",
      entityType: "SystemAlert",
      entityId: alert._id,
      metadata: { severity: alert.severity, type: alert.type },
    });

    return alert;
  }

  static async getAlerts({ tenantId, severity, resolved, type, limit = 50, skip = 0 }) {
    const query = {};
    if (tenantId) query.tenantId = tenantId;
    if (severity) query.severity = severity;
    if (resolved !== undefined) query.resolved = resolved;
    if (type) query.type = type;

    const [alerts, total] = await Promise.all([
      SystemAlert.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SystemAlert.countDocuments(query),
    ]);
    return { alerts, total, limit, skip };
  }

  static async _notifyAdmins(alert) {
    if (!alert.tenantId) return;
    const NotificationService = require("./notificationService");
    await NotificationService.notifyAdmins({
      tenantId: alert.tenantId,
      type: "system_notification",
      title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      message: alert.message,
      entityType: "security",
      entityId: alert._id,
      metadata: {
        alertId: alert._id,
        severity: alert.severity,
        type: alert.type,
        fingerprint: alert.fingerprint,
        endpoint: alert.endpoint,
      },
      priority: alert.severity === "critical" ? "critical" : "high",
    });
  }
}

module.exports = SystemAlertService;
