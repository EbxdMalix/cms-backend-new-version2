const PERMISSIONS = require("../constants/permissions");

const checkPermission = (moduleName) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (user.role === "admin") return next();

    if (user.role === "operator") {
      // Predefined operational access: Operators cannot access user management
      if (moduleName === PERMISSIONS.USERS) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Operators do not have user management privileges."
        });
      }
      return next();
    }

    if (user.role === "custom") {
      if (user.customPermissions && user.customPermissions[moduleName] === true) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: `Access denied. No permission for module: ${moduleName}`
      });
    }

    return res.status(403).json({ success: false, message: "Unauthorized" });
  };
};

module.exports = checkPermission;
