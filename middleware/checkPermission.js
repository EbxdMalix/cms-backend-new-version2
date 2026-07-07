const PERMISSIONS = require("../constants/permissions");

const checkPermission = (moduleName) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (user.role === "admin") return next();

    const { logAudit } = require("../utils/audit");

    // Parent permission mapping for granular route permissions
    const parentPermissionMap = {
      [PERMISSIONS.CHART_OF_ACCOUNTS]: "accounting",
      [PERMISSIONS.ACCOUNTING]: "accounting",
      [PERMISSIONS.REPORTS]: "reports",
      [PERMISSIONS.MULTI_CURRENCY]: "finance",
      [PERMISSIONS.TAX_GST]: "finance",
      [PERMISSIONS.BUDGET_FORECASTING]: "finance",
      [PERMISSIONS.FIXED_ASSETS]: "finance",
      [PERMISSIONS.CRM_SALES]: "crm",
      [PERMISSIONS.HR_PAYROLL]: "hr",
      [PERMISSIONS.DOCUMENT_MANAGEMENT]: "documents",
      [PERMISSIONS.ANALYTICS_BI]: "analytics",
    };

    let checkKey = moduleName;
    if (parentPermissionMap[moduleName]) {
      checkKey = parentPermissionMap[moduleName];
    }

    if (user.role === "operator") {
      // Check if this operator has custom overrides in database, otherwise fall back to defaults
      if (user.customPermissions && Object.keys(user.customPermissions).length > 0) {
        if (user.customPermissions[checkKey] === true) {
          return next();
        }
      } else if (PERMISSIONS.OPERATOR_PERMISSIONS.includes(moduleName)) {
        return next();
      }
      
      logAudit({
        tenantId: req.tenantId,
        userId: user._id,
        action: "reject",
        entityType: "ModuleAccess",
        entityId: user._id,
        metadata: { module: moduleName, desc: `Operator attempted to access restricted module: ${moduleName}` }
      });

      return res.status(403).json({
        success: false,
        message: `Access denied. Operators do not have permission for module: ${moduleName}`
      });
    }

    if (user.role === "custom") {
      if (user.customPermissions && user.customPermissions[checkKey] === true) {
        return next();
      }
      
      logAudit({
        tenantId: req.tenantId,
        userId: user._id,
        action: "reject",
        entityType: "ModuleAccess",
        entityId: user._id,
        metadata: { module: moduleName, desc: `Custom user attempted to access restricted module: ${moduleName}` }
      });

      return res.status(403).json({
        success: false,
        message: `Access denied. No permission for module: ${moduleName}`
      });
    }

    logAudit({
      tenantId: req.tenantId,
      userId: user._id,
      action: "reject",
      entityType: "ModuleAccess",
      entityId: user._id,
      metadata: { module: moduleName, desc: `Unauthorized role ${user.role} attempted to access module: ${moduleName}` }
    });

    return res.status(403).json({ success: false, message: "Unauthorized" });
  };
};

module.exports = checkPermission;
