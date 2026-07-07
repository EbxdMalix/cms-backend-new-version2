const SystemAlertService = require("../services/systemAlertService");

exports.getAlerts = async (req, res) => {
  try {
    const { severity, resolved, type, limit, skip } = req.query;
    const result = await SystemAlertService.getAlerts({
      tenantId: req.tenantId,
      severity,
      resolved: resolved !== undefined ? resolved === "true" : undefined,
      type,
      limit: parseInt(limit) || 50,
      skip: parseInt(skip) || 0,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({ success: false, message: "Error fetching alerts" });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const alert = await SystemAlertService.resolve(req.params.id, req.user._id);
    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }
    res.status(200).json({ success: true, data: alert });
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ success: false, message: "Error resolving alert" });
  }
};
