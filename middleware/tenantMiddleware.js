const tenantMiddleware = async (req, res, next) => {
  try {
    // Extract tenantId from authenticated user (set by authMiddleware)
    if (req.user && req.user.tenantId) {
      req.tenantId = req.user.tenantId;
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: "Tenant information not found. Please login again.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error with tenant middleware",
      error: error.message,
    });
  }
};

module.exports = tenantMiddleware;
