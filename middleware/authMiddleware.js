const { getAuth, clerkClient } = require("@clerk/express");
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

// Protect routes - verify Clerk session token and load user context
exports.protect = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    // Get user from DB by clerkId
    let user = await User.findOne({ clerkId: userId });

    // Fallback: if user is not synced with clerkId, try to find by email from Clerk
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress;

        if (email) {
          user = await User.findOne({ email: email.toLowerCase() });
          if (user) {
            user.clerkId = userId;
            await user.save();
          }
        }
      } catch (clerkErr) {
        console.error("Error fetching user details from Clerk:", clerkErr);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized - User profile not found in system",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    req.user = user;

    // Resolve tenant context via X-Tenant-ID header
    const headerTenantId = req.headers["x-tenant-id"];
    
    // Define tenant-agnostic paths that do not require x-tenant-id
    const agnosticPaths = ["/api/auth/me", "/api/auth/clerk-sync", "/api/auth/switch-portal", "/api/auth/set-default", "/api/auth/logout", "/api/auth/invitation"];
    const isAgnostic = agnosticPaths.some(path => req.originalUrl.startsWith(path));

    const jwt = require("jsonwebtoken");
    const { resolveTenantContext } = require("../utils/tenantContext");

    // Check for pre-resolved session JWT context inside headers (Authorization Bearer or custom x-context-token)
    const contextToken = req.headers["x-context-token"] || (req.headers["authorization"]?.split(" ")[1]);

    if (headerTenantId) {
      let resolvedContext = null;
      let cacheMiss = true;

      // Try resolving cached context from local JWT signature and verify version matches database
      if (contextToken) {
        try {
          const decoded = jwt.verify(contextToken, process.env.JWT_SECRET);
          if (decoded && decoded.tenantId === headerTenantId) {
            // Verify DB version matches cached context token version
            const UserPortalAccess = require("../models/UserPortalAccess");
            const dbAccess = await UserPortalAccess.findOne({
              userId: req.user._id,
              tenantId: headerTenantId,
              isActive: true,
            });
            
            if (dbAccess && (dbAccess.permissionVersion || 1) === (decoded.permissionVersion || 1)) {
              resolvedContext = decoded;
              cacheMiss = false;
            }
          }
        } catch (jwtErr) {
          // Token expired or invalid -> Fall back to MongoDB query validation
        }
      }

      // If cache missed -> query MongoDB via resolveTenantContext
      if (!resolvedContext) {
        try {
          resolvedContext = await resolveTenantContext(req.user._id, headerTenantId);
          cacheMiss = true;
        } catch (err) {
          if (err.message === "WORKSPACE_INACTIVE") {
            return res.status(403).json({
              success: false,
              message: "Access denied. This workspace is deactivated or does not exist.",
            });
          }
          return res.status(403).json({
            success: false,
            message: "Access denied. No active membership for this portal.",
          });
        }
      }

      if (resolvedContext) {
        req.tenantId = resolvedContext.tenantId;
        req.user.role = resolvedContext.role;
        req.user.customPermissions = resolvedContext.customPermissions;
        req.tenantContext = resolvedContext;

        // If cache missed (version mismatch or token refreshed/re-resolved from database),
        // sign a new Context JWT and send it via the X-Refresh-Token header
        if (cacheMiss) {
          try {
            const newToken = jwt.sign(
              {
                id: req.user._id,
                tenantId: resolvedContext.tenantId,
                role: resolvedContext.role,
                customPermissions: resolvedContext.customPermissions,
                permissionVersion: resolvedContext.permissionVersion || 1,
              },
              process.env.JWT_SECRET,
              {
                expiresIn: "7d",
                algorithm: "HS256"
              }
            );
            res.setHeader("x-refresh-token", newToken);
            res.setHeader("Access-Control-Expose-Headers", "x-refresh-token");
          } catch (signErr) {
            console.error("Error signing refreshed context token:", signErr);
          }
        }
      }
    } else {
      // If header is missing and the route is NOT agnostic -> REJECT
      if (!isAgnostic) {
        return res.status(400).json({
          success: false,
          code: "MISSING_TENANT_HEADER",
          message: "Multi-tenant context header (x-tenant-id) is missing. Request rejected for isolation security.",
        });
      }

      // OPTIMIZED DEFAULT RESOLUTION STRATEGY (For Agnostic Routes only)
      const UserPortalAccess = require("../models/UserPortalAccess");
      
      const activeMemberships = await UserPortalAccess.find({
        userId: req.user._id,
        isActive: true,
      }).sort({ isDefaultPortal: -1, lastAccessedAt: -1 }); // Priority: Default first, then last accessed

      if (activeMemberships.length > 0) {
        try {
          const context = await resolveTenantContext(req.user._id, activeMemberships[0].tenantId);
          if (context) {
            req.tenantId = context.tenantId;
            req.user.role = context.role;
            req.user.customPermissions = context.customPermissions;
            req.tenantContext = context;
          }
        } catch (err) {
          req.tenantId = null;
        }
      } else {
        req.tenantId = null;
      }
    }

    const tenantLocalStorage = require("../utils/tenantStorage");
    const store = tenantLocalStorage.getStore();
    if (store && req.tenantId) {
      store.set("tenantId", req.tenantId);
    }

    next();
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
