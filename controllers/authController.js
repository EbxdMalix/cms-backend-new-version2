const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { blacklistToken } = require("../middleware/authMiddleware");

// Generate JWT Token with enhanced security
const generateToken = (userId, tenantId = null, role = null, customPermissions = null, permissionVersion = 1) => {
  const payload = {
    id: userId,
    iat: Math.floor(Date.now() / 1000), // Issued at timestamp
  };
  if (tenantId) {
    payload.tenantId = tenantId;
    payload.role = role;
    payload.customPermissions = customPermissions;
    payload.permissionVersion = permissionVersion;
  }
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256", // Explicitly specify algorithm
    }
  );
};

// @desc    Register a new user (Admin only via Postman)
// @route   POST /api/auth/register
// @access  Public (but should be restricted in production)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check if user already exists globally (no tenant scope for registration)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Derive tenantId from auth context if authenticated, otherwise bootstrap with first tenant
    let userTenantId = req.tenantId;
    if (!userTenantId) {
      const Tenant = require("../models/Tenant");
      const tenant = await Tenant.findOne();
      if (!tenant) {
        return res.status(400).json({
          success: false,
          message:
            "No tenant found. Please create a portal first using /api/tenant/register",
        });
      }
      userTenantId = tenant.tenantId;
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
      tenantId: userTenantId,
    });

    // Create default portal access membership
    const UserPortalAccess = require("../models/UserPortalAccess");
    await UserPortalAccess.create({
      userId: user._id,
      tenantId: userTenantId,
      role: role || "operator",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    console.log("Login attempt received:", {
      email: req.body.email,
      timestamp: new Date().toISOString(),
    });
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      console.log("Login failed: Missing credentials");
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user by email only - system will automatically find their tenant
    const { logAudit } = require("../utils/audit");
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      await logAudit({
        tenantId: null,
        userId: null,
        action: "login",
        entityType: "User",
        entityId: null,
        metadata: { action: "LOGIN_FAILED", desc: `Failed login attempt: user with email ${email} not found` }
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await logAudit({
        tenantId: null,
        userId: user._id,
        action: "login",
        entityType: "User",
        entityId: user._id,
        metadata: { action: "LOGIN_FAILED", desc: `Failed login attempt: account for ${email} is deactivated` }
      });
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      await logAudit({
        tenantId: null,
        userId: user._id,
        action: "login",
        entityType: "User",
        entityId: user._id,
        metadata: { action: "LOGIN_FAILED", desc: `Failed login attempt: password mismatch for ${email}` }
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Fetch all user portal access records and filter by active tenants
    const UserPortalAccess = require("../models/UserPortalAccess");
    const Tenant = require("../models/Tenant");
    const rawPortalAccesses = await UserPortalAccess.find({ userId: user._id, isActive: true });

    const portalAccesses = [];
    for (const access of rawPortalAccesses) {
      const tenantInfo = await Tenant.findOne({ tenantId: access.tenantId, isActive: true });
      if (tenantInfo) {
        portalAccesses.push(access);
      }
    }

    // Resolve active tenant details based on defaults / count
    let activeTenantId = null;
    let activeRole = user.role;
    let activePermissions = user.customPermissions;
    let isAutoRouted = false;

    if (portalAccesses.length === 0) {
      await logAudit({
        tenantId: null,
        userId: user._id,
        action: "login",
        entityType: "User",
        entityId: user._id,
        metadata: { action: "LOGIN_FAILED", desc: `Failed login attempt: no active memberships for ${email}` }
      });
      return res.status(403).json({
        success: false,
        message: "Access denied. No active memberships configured for this account.",
      });
    }

    // Find default portal access
    const defaultAccess = portalAccesses.find((p) => p.isDefaultPortal === true);

    if (defaultAccess) {
      activeTenantId = defaultAccess.tenantId;
      activeRole = defaultAccess.role;
      activePermissions = defaultAccess.customPermissions;
      isAutoRouted = true;
    } else if (portalAccesses.length === 1) {
      activeTenantId = portalAccesses[0].tenantId;
      activeRole = portalAccesses[0].role;
      activePermissions = portalAccesses[0].customPermissions;
      isAutoRouted = true;
    } else if (portalAccesses.length > 1) {
      // If multiple portals exist but no default is set,
      // generate token for the first one, but set isAutoRouted = false
      activeTenantId = portalAccesses[0].tenantId;
      activeRole = portalAccesses[0].role;
      activePermissions = portalAccesses[0].customPermissions;
      isAutoRouted = false;
    }

    // Update lastAccessedAt timestamp for the resolved active portal
    if (activeTenantId && portalAccesses.length > 0) {
      await UserPortalAccess.updateOne(
        { userId: user._id, tenantId: activeTenantId },
        { $set: { lastAccessedAt: new Date() } }
      );
    }

    // Generate token containing the active tenantId
    const activeAccess = activeTenantId && portalAccesses.find(acc => acc.tenantId === activeTenantId);
    const token = generateToken(
      user._id,
      activeTenantId,
      activeRole,
      activePermissions,
      activeAccess ? (activeAccess.permissionVersion || 1) : 1
    );

    // Get active tenant info
    let tenant = null;
    if (activeTenantId) {
      tenant = await Tenant.findOne({ tenantId: activeTenantId }).select("-password");
    }

    // Map all associated portals
    const associatedPortals = [];
    for (const access of portalAccesses) {
      const tenantInfo = await Tenant.findOne({ tenantId: access.tenantId });
      if (tenantInfo) {
        associatedPortals.push({
          tenantId: access.tenantId,
          portalName: tenantInfo.portalName,
          role: access.role,
          customPermissions: access.customPermissions,
          isDefaultPortal: access.isDefaultPortal,
          lastAccessedAt: access.lastAccessedAt,
          branding: tenantInfo.branding || null,
        });
      }
    }

    await logAudit({
      tenantId: activeTenantId,
      userId: user._id,
      action: "login",
      entityType: "User",
      entityId: user._id,
      metadata: { action: "LOGIN_SUCCESS", desc: `User logged in successfully` }
    });

    console.log("Login successful for:", email);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: activeRole,
          tenantId: activeTenantId,
          customPermissions: activePermissions,
        },
        tenant: tenant
          ? {
              tenantId: tenant.tenantId,
              portalName: tenant.portalName,
              branding: tenant.branding || null,
            }
          : null,
        portals: associatedPortals,
        isAutoRouted,
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const Tenant = require("../models/Tenant");
    const tenant = req.tenantId
      ? await Tenant.findOne({ tenantId: req.tenantId, isActive: true }).select("-password")
      : null;

    // Fetch all user portal access records and filter by active tenants
    const UserPortalAccess = require("../models/UserPortalAccess");
    const rawPortalAccesses = await UserPortalAccess.find({ userId: user._id, isActive: true });

    const associatedPortals = [];
    for (const access of rawPortalAccesses) {
      const tenantInfo = await Tenant.findOne({ tenantId: access.tenantId, isActive: true });
      if (tenantInfo) {
        associatedPortals.push({
          tenantId: access.tenantId,
          portalName: tenantInfo.portalName,
          role: access.role,
          customPermissions: access.customPermissions,
          isDefaultPortal: access.isDefaultPortal,
          lastAccessedAt: access.lastAccessedAt,
          branding: tenantInfo.branding || null,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: req.user.role,
        tenantId: req.tenantId,
        customPermissions: req.user.customPermissions,
        tenant: tenant
          ? {
              tenantId: tenant.tenantId,
              portalName: tenant.portalName,
              branding: tenant.branding || null,
            }
          : null,
        portals: associatedPortals,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// @desc    Logout user (blacklist token)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    // Get token from request (set by protect middleware)
    const token = req.token;

    if (token) {
      // Add token to blacklist
      await blacklistToken(token);
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging out",
      error: error.message,
    });
  }
};

// @desc    Switch active tenant portal
// @route   POST /api/auth/switch-portal
// @access  Private
exports.switchPortal = async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Please provide a tenantId",
      });
    }

    const UserPortalAccess = require("../models/UserPortalAccess");
    const access = await UserPortalAccess.findOne({
      userId: req.user.id,
      tenantId,
      isActive: true,
    });

    if (!access) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have access to this portal.",
      });
    }

    // Update lastAccessedAt timestamp
    await UserPortalAccess.updateOne(
      { userId: req.user.id, tenantId },
      { $set: { lastAccessedAt: new Date() } }
    );

    const Tenant = require("../models/Tenant");
    const tenant = await Tenant.findOne({ tenantId, isActive: true }).select("-password");

    if (!tenant) {
      return res.status(403).json({
        success: false,
        message: "Access denied. This workspace is deactivated or does not exist.",
      });
    }

    const { logAudit } = require("../utils/audit");
    await logAudit({
      tenantId: tenantId,
      userId: req.user._id,
      action: "update",
      entityType: "Session",
      entityId: req.user._id,
      before: { activeTenantId: req.tenantId },
      after: { activeTenantId: tenantId },
      metadata: { action: "TENANT_SWITCH", desc: `User switched active workspace from ${req.tenantId || "None"} to ${tenantId}` }
    });

    // Generate new token containing the new active tenantId
    const token = generateToken(
      req.user.id,
      tenantId,
      access.role,
      access.customPermissions,
      access.permissionVersion || 1
    );

    res.status(200).json({
      success: true,
      message: "Portal switched successfully",
      data: {
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: access.role,
          tenantId: access.tenantId,
          customPermissions: access.customPermissions,
        },
        tenant: {
          tenantId: tenant.tenantId,
          portalName: tenant.portalName,
          branding: tenant.branding || null,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Switch portal error:", error);
    res.status(500).json({
      success: false,
      message: "Error switching portal",
      error: error.message,
    });
  }
};

// @desc    Set default portal for user
// @route   POST /api/auth/set-default
// @access  Private
exports.setDefaultPortal = async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Please provide a tenantId",
      });
    }

    const UserPortalAccess = require("../models/UserPortalAccess");

    // Clear previous defaults for this user
    await UserPortalAccess.updateMany(
      { userId: req.user.id },
      { $set: { isDefaultPortal: false } }
    );

    // Set new default portal membership
    const updated = await UserPortalAccess.updateOne(
      { userId: req.user.id, tenantId },
      { $set: { isDefaultPortal: true } }
    );

    if (updated.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Portal membership not found for this user",
      });
    }

    res.status(200).json({
      success: true,
      message: "Default portal configured successfully",
    });
  } catch (error) {
    console.error("Set default portal error:", error);
    res.status(500).json({
      success: false,
      message: "Error configuring default portal",
      error: error.message,
    });
  }
};

// @desc    Update user profile (self)
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name) user.name = name;
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({
          success: false,
          message: "Email is already taken by another account",
        });
      }
      user.email = email;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// @desc    Change password (self)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current password and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid current password",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

