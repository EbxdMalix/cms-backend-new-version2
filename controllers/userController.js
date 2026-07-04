const User = require("../models/User");

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

    const populatedUsers = [];
    for (const u of users) {
      const uAccesses = await UserPortalAccess.find({ userId: u._id, isActive: true });
      const portalIds = uAccesses.map(acc => acc.tenantId);
      
      populatedUsers.push({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        customPermissions: u.customPermissions,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        portalAccessIds: portalIds,
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
    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
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
    const { name, email, password, role, customPermissions, portalAccessIds } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Please provide name and email",
      });
    }

    // Check if user already exists globally
    let user = await User.findOne({ email });
    const UserPortalAccess = require("../models/UserPortalAccess");

    if (user) {
      // Check if they already have access to the current tenant
      const existingAccess = await UserPortalAccess.findOne({ userId: user._id, tenantId: req.tenantId, isActive: true });
      if (existingAccess) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists in your organization",
        });
      }
    } else {
      // Password is required for new users
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required for new users",
        });
      }

      // Create user data
      const userData = {
        tenantId: req.tenantId,
        name,
        email,
        password,
        role: role || "operator",
      };

      // Add customPermissions only if role is custom
      if (role === "custom" && customPermissions) {
        userData.customPermissions = customPermissions;
      }

      // Create new user
      user = await User.create(userData);
    }

    // Determine portals to grant access to (default to current admin's active tenant)
    const targets = Array.isArray(portalAccessIds) && portalAccessIds.length > 0
      ? portalAccessIds
      : [req.tenantId];

    // Grant portal access for each target tenant
    for (const tId of targets) {
      await UserPortalAccess.updateOne(
        { userId: user._id, tenantId: tId },
        {
          $set: {
            role: role || "operator",
            customPermissions: role === "custom" ? customPermissions : null,
            isActive: true,
          }
        },
        { upsert: true }
      );
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        customPermissions: user.customPermissions,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user",
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
    const adminAccess = await UserPortalAccess.findOne({ userId: req.params.id, tenantId: req.tenantId });
    if (!adminAccess && req.user.role !== "admin") {
      return res.status(430).json({
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

    // Prevent admin from deactivating themselves
    if (req.user.id === req.params.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Update fields
    if (name) user.name = name;
    if (email) {
      // Check if email is already taken by another user
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
    if (role) user.role = role;
    if (typeof isActive === "boolean") user.isActive = isActive;

    // Update customPermissions only if role is custom
    if (role === "custom" && customPermissions) {
      user.customPermissions = customPermissions;
    } else if (role && role !== "custom") {
      user.customPermissions = null;
    }

    await user.save();

    // Synchronize workspace memberships if portalAccessIds list is provided
    if (Array.isArray(portalAccessIds)) {
      // Grant portal access for each target tenant
      for (const tId of portalAccessIds) {
        await UserPortalAccess.updateOne(
          { userId: user._id, tenantId: tId },
          {
            $set: {
              role: role || user.role,
              customPermissions: role === "custom" ? customPermissions : (role ? null : user.customPermissions),
              isActive: true,
            }
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
          { $set: { isActive: false } }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        customPermissions: user.customPermissions,
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

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// @desc    Toggle user status (activate/deactivate)
// @route   PATCH /api/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from deactivating themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,
      data: {
        id: user._id,
        isActive: user.isActive,
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
