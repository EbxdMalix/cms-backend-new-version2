const jwt = require("jsonwebtoken");
const User = require("../models/User");
const BlacklistedToken = require("../models/BlacklistedToken");

// Add token to blacklist (call this on logout)
exports.blacklistToken = async (token) => {
  try {
    await BlacklistedToken.create({ token });
  } catch (err) {
    if (err.code !== 11000) {
      console.error("Error blacklisting token:", err);
    }
  }
};

// Check if token is blacklisted
const isTokenBlacklisted = async (token) => {
  try {
    const exists = await BlacklistedToken.exists({ token });
    return !!exists;
  } catch (err) {
    console.error("Error checking token blacklist status:", err);
    return false;
  }
};

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: "Token has been revoked",
      });
    }

    try {
      // Verify token with additional security checks
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"], // Explicitly specify allowed algorithms
        clockTolerance: 0, // No tolerance for clock skew
      });

      // Check token expiration
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return res.status(401).json({
          success: false,
          message: "Token has expired",
        });
      }

      // Get user from token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Extract active tenantId from JWT or fallback to portal membership
      if (decoded.tenantId) {
        const Tenant = require("../models/Tenant");
        const tenantInfo = await Tenant.findOne({ tenantId: decoded.tenantId, isActive: true });
        if (!tenantInfo) {
          return res.status(403).json({
            success: false,
            message: "Access denied. This workspace is deactivated or does not exist.",
          });
        }

        const UserPortalAccess = require("../models/UserPortalAccess");
        const access = await UserPortalAccess.findOne({
          userId: req.user._id,
          tenantId: decoded.tenantId,
          isActive: true,
        });

        if (access) {
          // Dynamically overload active tenant, role, and customPermissions
          req.tenantId = access.tenantId;
          req.user.role = access.role;
          req.user.customPermissions = access.customPermissions;
        } else {
          return res.status(403).json({
            success: false,
            message: "Access denied. No active membership for this portal.",
          });
        }
      } else {
        // Fallback to first available active portal membership
        const UserPortalAccess = require("../models/UserPortalAccess");
        const Tenant = require("../models/Tenant");
        
        const activeMemberships = await UserPortalAccess.find({
          userId: req.user._id,
          isActive: true,
        });

        let validAccess = null;
        for (const membership of activeMemberships) {
          const tenantInfo = await Tenant.findOne({ tenantId: membership.tenantId, isActive: true });
          if (tenantInfo) {
            validAccess = membership;
            break;
          }
        }

        if (validAccess) {
          req.tenantId = validAccess.tenantId;
          req.user.role = validAccess.role;
          req.user.customPermissions = validAccess.customPermissions;
        } else {
          req.tenantId = null;
        }
      }

      // Store token for potential blacklisting
      req.token = token;

      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      } else if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Admin role check middleware
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
};
