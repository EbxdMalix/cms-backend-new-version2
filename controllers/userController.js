const User = require("../models/User");
const { logAudit } = require("../utils/audit");
const { notifyAdmins } = require("./notificationController");

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const UserPortalAccess = require("../models/UserPortalAccess");
    const accesses = await UserPortalAccess.find({ tenantId: req.tenantId, isActive: true });
    const userIds = accesses.map(acc => acc.userId);

    const users = await User.find({
      $or: [
        { _id: { $in: userIds } },
        { tenantId: req.tenantId }
      ]
    }).select("-password").sort({ createdAt: -1 });

    const hasUserMgmtPermission =
      req.user.role === "admin" ||
      (req.user.role === "custom" && req.user.customPermissions?.users === true);

    if (!hasUserMgmtPermission) {
      const simplifiedUsers = users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
      }));
      return res.status(200).json({
        success: true,
        data: simplifiedUsers,
      });
    }

    const populatedUsers = [];
    for (const u of users) {
      const uAccesses = await UserPortalAccess.find({ userId: u._id, isActive: true });
      const portalIds = uAccesses.map(acc => acc.tenantId);
      
      // Find the specific access details for the current active tenant workspace
      const currentAccess = uAccesses.find(acc => acc.tenantId === req.tenantId);
      
      populatedUsers.push({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: currentAccess ? currentAccess.role : "operator",
        isActive: currentAccess ? currentAccess.isActive : true,
        customPermissions: currentAccess ? currentAccess.customPermissions : null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        portalAccessIds: portalIds,
      });
    }

    // Fetch pending invitations for this workspace
    const Invitation = require("../models/Invitation");
    const pendingInvites = await Invitation.find({
      tenantId: req.tenantId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    for (const invite of pendingInvites) {
      populatedUsers.push({
        _id: invite._id,
        name: `${invite.email.split("@")[0]} (Pending)`,
        email: invite.email,
        role: invite.role,
        isActive: false,
        isPendingInvite: true,
        customPermissions: invite.customPermissions,
        createdAt: invite.createdAt,
        updatedAt: invite.updatedAt,
        portalAccessIds: [],
      });
    }

    res.status(200).json({
      success: true,
      count: populatedUsers.length,
      data: populatedUsers,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const UserPortalAccess = require("../models/UserPortalAccess");
    const hasAccess = await UserPortalAccess.findOne({
      userId: req.params.id,
      tenantId: req.tenantId,
      isActive: true
    });

    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        message: "User not found in this workspace",
      });
    }

    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: hasAccess.role,
        isActive: hasAccess.isActive,
        customPermissions: hasAccess.customPermissions,
        createdAt: user.createdAt
      },
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { name, email, role, customPermissions, portalAccessIds } = req.body;

    const ROLE_LEVELS = {
      operator: 1,
      custom: 2,
      admin: 3,
      superadmin: 4
    };
    const currentUserRoleLevel = ROLE_LEVELS[req.user.role] || 1;
    const targetRoleLevel = ROLE_LEVELS[role || "operator"] || 1;
    if (targetRoleLevel >= currentUserRoleLevel) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot create/invite a role level higher than or equal to your own."
      });
    }

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already has access to this workspace
    const UserPortalAccess = require("../models/UserPortalAccess");
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const activeAccess = await UserPortalAccess.findOne({
        userId: existingUser._id,
        tenantId: req.tenantId,
        isActive: true
      });
      if (activeAccess) {
        return res.status(400).json({
          success: false,
          message: "User with this email already belongs to this workspace.",
        });
      }
    }

    // Revoke any previous pending invitations for this email in this workspace
    const Invitation = require("../models/Invitation");
    const pendingInvites = await Invitation.find({
      email: normalizedEmail,
      tenantId: req.tenantId,
      status: "pending"
    });
    if (pendingInvites.length > 0) {
      await Invitation.updateMany(
        { email: normalizedEmail, tenantId: req.tenantId, status: "pending" },
        { $set: { status: "revoked" } }
      );
      for (const invite of pendingInvites) {
        await logAudit({
          tenantId: req.tenantId,
          userId: req.user._id,
          action: "update",
          entityType: "Invitation",
          entityId: invite._id,
          before: { status: "pending" },
          after: { status: "revoked" },
          metadata: { action: "INVITATION_REVOKED", desc: `Revoked previous pending invitation for ${normalizedEmail}` }
        });
      }
    }

    // Generate secure registration token & secure hash
    const crypto = require("crypto");
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours expiration

    const invitation = await Invitation.create({
      email: normalizedEmail,
      tenantId: req.tenantId,
      name: name || null,
      role: role || "operator",
      customPermissions: (role === "custom" || role === "operator") ? customPermissions : null,
      portalAccessIds: Array.isArray(portalAccessIds) ? portalAccessIds : [],
      invitedBy: req.user._id,
      token: hashedToken,
      expiresAt
    });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user._id,
      action: "create",
      entityType: "Invitation",
      entityId: invitation._id,
      after: { email: normalizedEmail, role, customPermissions },
      metadata: { action: "INVITATION_CREATED", desc: `Created workspace invitation for ${normalizedEmail}` }
    });

    // Send invitation email via SMTP / Job Queue dispatch helper
    const Tenant = require("../models/Tenant");
    const tenantInfo = await Tenant.findOne({ tenantId: req.tenantId });
    const { sendInvitationEmail } = require("../utils/email");
    await sendInvitationEmail(normalizedEmail, tenantInfo ? tenantInfo.portalName : "Workspace", rawToken, role || "operator", req.tenantId);

    notifyAdmins({
      tenantId: req.tenantId,
      sender: req.user._id,
      type: "user_created",
      title: "New User Invited",
      message: `Invitation sent to ${normalizedEmail} with role ${role || "operator"} by ${req.user.name}`,
      entityType: "user",
      entityId: invitation._id,
      metadata: { email: normalizedEmail, role: role || "operator" },
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({
      success: true,
      message: "Invitation created and dispatched successfully",
      data: {
        id: invitation._id,
        name: name || invitation.email.split("@")[0],
        email: invitation.email,
        role: invitation.role,
        isActive: true,
        customPermissions: invitation.customPermissions,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error) {
    console.error("Create user/invite error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user invitation",
      error: error.message,
    });
  }
};

// @desc    Resend workspace invitation
// @route   POST /api/users/invitation/:id/resend
// @access  Private/Admin
exports.resendInvitation = async (req, res) => {
  try {
    const Invitation = require("../models/Invitation");
    const invite = await Invitation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      status: "pending",
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Pending invitation not found in this workspace",
      });
    }

    // Generate new secure registration token & secure hash
    const crypto = require("crypto");
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours expiration

    invite.token = hashedToken;
    invite.expiresAt = expiresAt;
    invite.attemptCount = (invite.attemptCount || 0) + 1;
    await invite.save();

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user._id,
      action: "update",
      entityType: "Invitation",
      entityId: invite._id,
      metadata: { action: "INVITATION_CREATED", desc: `Resent workspace invitation to ${invite.email}` }
    });

    // Send invitation email via SMTP
    const Tenant = require("../models/Tenant");
    const tenantInfo = await Tenant.findOne({ tenantId: req.tenantId });
    const { sendInvitationEmail } = require("../utils/email");
    await sendInvitationEmail(invite.email, tenantInfo ? tenantInfo.portalName : "Workspace", rawToken, invite.role || "operator", req.tenantId);

    res.status(200).json({
      success: true,
      message: "Invitation resent successfully",
    });
  } catch (error) {
    console.error("Resend invitation error:", error);
    res.status(500).json({
      success: false,
      message: "Error resending invitation",
      error: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { name, email, password, role, customPermissions, isActive, portalAccessIds } = req.body;

    const UserPortalAccess = require("../models/UserPortalAccess");
    let access = await UserPortalAccess.findOne({ userId: req.params.id, tenantId: req.tenantId });
    if (!access && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to manage this user.",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const ROLE_LEVELS = {
      operator: 1,
      custom: 2,
      admin: 3,
      superadmin: 4
    };
    const currentUserRoleLevel = ROLE_LEVELS[req.user.role] || 1;

    // Check existing role
    if (access) {
      const existingUserRoleLevel = ROLE_LEVELS[access.role] || 1;
      if (existingUserRoleLevel >= currentUserRoleLevel && req.user.id !== req.params.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You cannot modify a user with a role level higher than or equal to your own."
        });
      }
    }

    // Check target role
    if (role) {
      const targetRoleLevel = ROLE_LEVELS[role] || 1;
      if (targetRoleLevel >= currentUserRoleLevel && req.user.id !== req.params.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You cannot assign a role level higher than or equal to your own."
        });
      }
    }

    const beforeState = access ? { role: access.role, isActive: access.isActive, customPermissions: access.customPermissions } : null;

    // Prevent admin from deactivating themselves
    if (req.user.id === req.params.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Update global user identity fields
    if (name) user.name = name;
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.params.id) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use",
        });
      }
      user.email = email;
    }
    if (password) user.password = password;
    await user.save();

    // Resolve or upsert the active workspace access record
    if (!access) {
      access = new UserPortalAccess({
        userId: user._id,
        tenantId: req.tenantId,
        isActive: true,
      });
    }

    // Update workspace-scoped fields
    if (role) access.role = role;
    if (typeof isActive === "boolean") access.isActive = isActive;
    
    if ((role === "custom" || role === "operator") && customPermissions) {
      access.customPermissions = customPermissions;
    } else if (role && role !== "custom" && role !== "operator") {
      access.customPermissions = null;
    }
    
    access.permissionVersion = (access.permissionVersion || 0) + 1;
    await access.save();

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user._id,
      action: "update",
      entityType: "User",
      entityId: user._id,
      before: beforeState,
      after: { role: access.role, isActive: access.isActive, customPermissions: access.customPermissions },
      metadata: { desc: `Updated workspace membership details for ${user.email}` }
    });

    // Synchronize other workspace memberships if portalAccessIds list is provided
    if (Array.isArray(portalAccessIds)) {
      for (const tId of portalAccessIds) {
        await UserPortalAccess.updateOne(
          { userId: user._id, tenantId: tId },
          {
            $set: {
              role: role || access.role,
              customPermissions: (role === "custom" || role === "operator") ? customPermissions : ((role && role !== "operator") ? null : access.customPermissions),
              isActive: true,
            },
            $inc: { permissionVersion: 1 }
          },
          { upsert: true }
        );
      }

      // Deactivate portals that were deselected (within this admin's scope)
      const adminPortals = await UserPortalAccess.find({ userId: req.user.id, isActive: true }).distinct("tenantId");
      const deselectedPortals = adminPortals.filter(t => !portalAccessIds.includes(t));
      if (deselectedPortals.length > 0) {
        await UserPortalAccess.updateMany(
          { userId: user._id, tenantId: { $in: deselectedPortals } },
          {
            $set: { isActive: false },
            $inc: { permissionVersion: 1 }
          }
        );
      }
    }

    // Retrieve final list of active portals
    const uAccesses = await UserPortalAccess.find({ userId: user._id, isActive: true });
    const portalIds = uAccesses.map(acc => acc.tenantId);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: access.role,
        isActive: access.isActive,
        customPermissions: access.customPermissions,
        portalAccessIds: portalIds,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const UserPortalAccess = require("../models/UserPortalAccess");
    const access = await UserPortalAccess.findOne({
      userId: req.params.id,
      tenantId: req.tenantId
    });

    if (!access) {
      // Check if it's a pending invitation to delete/revoke
      const Invitation = require("../models/Invitation");
      const deletedInvite = await Invitation.findOneAndDelete({
        _id: req.params.id,
        tenantId: req.tenantId,
        status: "pending"
      });

      if (deletedInvite) {
        await logAudit({
          tenantId: req.tenantId,
          userId: req.user._id,
          action: "delete",
          entityType: "Invitation",
          entityId: deletedInvite._id,
          before: { email: deletedInvite.email, role: deletedInvite.role },
          metadata: { action: "INVITATION_REVOKED", desc: `Revoked/deleted workspace invitation for ${deletedInvite.email}` }
        });

        return res.status(200).json({
          success: true,
          message: "Invitation deleted/revoked successfully",
        });
      }

      return res.status(404).json({
        success: false,
        message: "User membership or invitation not found in this workspace",
      });
    }

    // Prevent administrators from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own membership",
      });
    }

    // Scoped Delete: Remove membership record only
    await UserPortalAccess.deleteOne({ userId: req.params.id, tenantId: req.tenantId });

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user._id,
      action: "delete",
      entityType: "User",
      entityId: req.params.id,
      before: { role: access.role, isActive: access.isActive },
      metadata: { desc: `Deleted workspace membership access for user ID ${req.params.id}` }
    });

    res.status(200).json({
      success: true,
      message: "User workspace membership deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user membership",
      error: error.message,
    });
  }
};

// @desc    Toggle user status (activate/deactivate)
// @route   PATCH /api/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res) => {
  try {
    const UserPortalAccess = require("../models/UserPortalAccess");
    const access = await UserPortalAccess.findOne({
      userId: req.params.id,
      tenantId: req.tenantId
    });

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "User membership not found in this workspace",
      });
    }

    // Prevent deactivating own account
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own membership",
      });
    }

    access.isActive = !access.isActive;
    await access.save();

    await logAudit({
      tenantId: req.tenantId,
      userId: req.user._id,
      action: "update",
      entityType: "User",
      entityId: req.params.id,
      before: { isActive: !access.isActive },
      after: { isActive: access.isActive },
      metadata: { desc: `Toggled user status to ${access.isActive ? "active" : "suspended"} for user ID ${req.params.id}` }
    });

    res.status(200).json({
      success: true,
      message: `User membership ${access.isActive ? "activated" : "deactivated"} successfully`,
      data: {
        id: req.params.id,
        isActive: access.isActive,
      },
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling user status",
      error: error.message,
    });
  }
};
