const AuditLog = require("../models/AuditLog");

/**
 * Log an audit trail event.
 * Runs asynchronously to prevent database latency from blocking main request threads.
 */
exports.logAudit = async ({
  tenantId,
  userId,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  metadata = null
}) => {
  try {
    if (!tenantId || !userId || !action || !entityType || !entityId) {
      console.warn("Audit log missing required parameters. Skipping log entry.");
      return;
    }
    
    await AuditLog.create({
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      before,
      after,
      metadata
    });
  } catch (err) {
    console.warn("Failed to save audit log:", err.message);
  }
};
