const User = require("../models/User");
const UserPortalAccess = require("../models/UserPortalAccess");
const Tenant = require("../models/Tenant");
const { getAuth, clerkClient } = require("@clerk/express");
const logger = require("../utils/logger");

/**
 * Sync Clerk session with MongoDB database.
 * If user does not exist, registers them and assigns default tenant portal workspace.
 */
exports.syncClerkUser = async (req, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Clerk session not found.",
      });
    }

    // Find user by clerkId
    let user = await User.findOne({ clerkId: userId });

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || clerkUser.username || "Clerk User";

    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    // 1. Resolve user profile in DB
    if (!user && normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        user.clerkId = userId;
        await user.save();
      }
    }

    // 2. Consolidate invitation claims
    if (normalizedEmail) {
      const Invitation = require("../models/Invitation");
      const pendingInvites = await Invitation.find({
        email: normalizedEmail,
        status: "pending",
        expiresAt: { $gt: new Date() }
      });

      if (pendingInvites.length > 0) {
        // Create user document if it does not exist yet
        if (!user) {
          user = await User.create({
            name: pendingInvites[0].name || name,
            email: normalizedEmail,
            clerkId: userId,
            role: "operator",
            isActive: true
          });
        }

        // Link UserPortalAccess memberships
        for (const invite of pendingInvites) {
          // Collect all tenant IDs to provision
          const provisionTenantIds = [invite.tenantId];
          if (Array.isArray(invite.portalAccessIds) && invite.portalAccessIds.length > 0) {
            for (const tId of invite.portalAccessIds) {
              if (!provisionTenantIds.includes(tId)) {
                provisionTenantIds.push(tId);
              }
            }
          }

          for (const tId of provisionTenantIds) {
            await UserPortalAccess.updateOne(
              { userId: user._id, tenantId: tId },
              {
                $set: {
                  role: invite.role,
                  customPermissions: invite.customPermissions,
                  isActive: true,
                  isDefaultPortal: false
                }
              },
              { upsert: true }
            );
          }

          invite.status = "accepted";
          invite.acceptedAt = new Date();
          await invite.save();
        }
      }
    }

    // Fetch active portal access memberships
    const rawPortalAccesses = user ? await UserPortalAccess.find({ userId: user._id, isActive: true }) : [];
    const portalAccesses = [];
    for (const access of rawPortalAccesses) {
      const tenantInfo = await Tenant.findOne({ tenantId: access.tenantId, isActive: true });
      if (tenantInfo) {
        portalAccesses.push(access);
      }
    }

    // 3. Strict Check: Verify they have at least one active workspace membership
    if (!user || portalAccesses.length === 0) {
      // Log blocked attempt
      logger.security("auth_blocked", {
        email: normalizedEmail || "unknown",
        clerkId: userId,
        reason: "not_invited"
      });

      const { logAudit } = require("../utils/audit");
      await logAudit({
        tenantId: null,
        userId: user ? user._id : null,
        action: "login",
        entityType: "User",
        entityId: user ? user._id : null,
        metadata: { action: "LOGIN_FAILED", desc: `Clerk session sync blocked: no active workspace membership for ${normalizedEmail || "unknown"}` }
      });

      return res.status(403).json({
        success: false,
        code: "NOT_INVITED",
        message: "Access Denied. You do not have an active invitation or workspace membership.",
      });
    }

    // Resolve active tenant details based on defaults / counts
    const defaultAccess = portalAccesses.find((p) => p.isDefaultPortal === true);
    let activeTenantId = null;
    let activeRole = user.role;
    let activePermissions = user.customPermissions;
    let isAutoRouted = false;

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
      activeTenantId = portalAccesses[0].tenantId;
      activeRole = portalAccesses[0].role;
      activePermissions = portalAccesses[0].customPermissions;
      isAutoRouted = false;
    }

    // Update lastAccessedAt timestamp
    if (activeTenantId) {
      await UserPortalAccess.updateOne(
        { userId: user._id, tenantId: activeTenantId },
        { $set: { lastAccessedAt: new Date() } }
      );
    }

    // Get active tenant details
    let tenantInfo = null;
    if (activeTenantId) {
      tenantInfo = await Tenant.findOne({ tenantId: activeTenantId });
    }

    // Map associated portals list
    const associatedPortals = [];
    for (const access of portalAccesses) {
      const tInfo = await Tenant.findOne({ tenantId: access.tenantId });
      if (tInfo) {
        associatedPortals.push({
          tenantId: access.tenantId,
          portalName: tInfo.portalName,
          role: access.role,
          customPermissions: access.customPermissions,
          isDefaultPortal: access.isDefaultPortal,
          lastAccessedAt: access.lastAccessedAt,
          branding: tInfo.branding || null,
        });
      }
    }

    const { logAudit } = require("../utils/audit");
    await logAudit({
      tenantId: activeTenantId,
      userId: user._id,
      action: "login",
      entityType: "User",
      entityId: user._id,
      metadata: { action: "LOGIN_SUCCESS", desc: `Clerk user session synchronized successfully` }
    });

    res.status(200).json({
      success: true,
      message: "User session synced successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: activeRole,
          tenantId: activeTenantId,
          customPermissions: activePermissions,
        },
        tenant: tenantInfo
          ? {
              tenantId: tenantInfo.tenantId,
              portalName: tenantInfo.portalName,
              branding: tenantInfo.branding || null,
            }
          : null,
        portals: associatedPortals,
        isAutoRouted,
      },
    });
  } catch (error) {
    console.error("Clerk sync controller error:", error);
    res.status(500).json({
      success: false,
      message: "Error syncing Clerk user session with backend profile",
      error: error.message,
    });
  }
};
