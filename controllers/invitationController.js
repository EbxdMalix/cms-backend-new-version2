const crypto = require("crypto");
const Invitation = require("../models/Invitation");
const User = require("../models/User");
const UserPortalAccess = require("../models/UserPortalAccess");
const { logAudit } = require("../utils/audit");

// @desc    Accept workspace invitation
// @route   POST /api/auth/invitation/accept
// @access  Public (Requires Clerk Session)
exports.acceptInvitation = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "Invitation token is required." });
    }

    const rawIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.ip || "127.0.0.1";
    const clientIp = rawIp.split(",")[0].trim();

    // Verify Clerk authenticated identity exists from request session
    const { getAuth, clerkClient } = require("@clerk/express");
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ success: false, message: "You must be logged in to accept invitations." });
    }

    // Hash incoming token to match database record
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Check attempt limits to prevent brute-forcing
    const existingInvite = await Invitation.findOne({ token: hashedToken });
    if (existingInvite && (existingInvite.attemptCount || 0) >= 5) {
      if (existingInvite.status !== "revoked") {
        existingInvite.status = "revoked";
        await existingInvite.save();
      }
      return res.status(403).json({
        success: false,
        message: "Too many failed attempts. This invitation has been blocked/revoked for security."
      });
    }

    // Atomic State Update (Replay/Race-condition Protection)
    const invite = await Invitation.findOneAndUpdate(
      {
        token: hashedToken,
        status: "pending",
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          status: "accepted",
          acceptedAt: new Date(),
          ipAddress: clientIp,
          clerkUserId: auth.userId
        },
        $inc: { attemptCount: 1 }
      },
      { new: true }
    );

    if (!invite) {
      // Track audit parameters for the failed acceptance attempt if invitation exists
      const failedInvite = await Invitation.findOne({ token: hashedToken });
      if (failedInvite) {
        failedInvite.attemptCount = (failedInvite.attemptCount || 0) + 1;
        failedInvite.lastAttemptAt = new Date();
        failedInvite.ipAddress = clientIp;
        failedInvite.clerkUserId = auth.userId;
        await failedInvite.save();
      }

      return res.status(400).json({
        success: false,
        message: "Invalid, expired, or already accepted invitation token."
      });
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const emailMatched = clerkUser.emailAddresses?.some(
      (e) => e.emailAddress.trim().toLowerCase() === invite.email
    );

    if (!emailMatched) {
      // Rollback the accepted status to pending as email validation failed, but log the attempt
      await Invitation.updateOne(
        { _id: invite._id },
        {
          $set: { status: "pending", acceptedAt: null },
          $inc: { attemptCount: 1 }
        }
      );
      return res.status(403).json({
        success: false,
        message: "This invitation was sent to a different email address."
      });
    }

    // Resolve or create User
    let user = await User.findOne({ email: invite.email });
    if (!user) {
      user = await User.create({
        name: invite.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
        email: invite.email,
        clerkId: auth.userId,
        role: invite.role,
        tenantId: invite.tenantId,
        isActive: true
      });
    } else {
      user.clerkId = auth.userId;
      await user.save();
    }

    // Link invitation owner
    invite.acceptedBy = user._id;
    await invite.save();

    // Check if the user already has an active default portal
    const defaultPortalExists = await UserPortalAccess.findOne({
      userId: user._id,
      isDefaultPortal: true,
      isActive: true
    });
    const isDefault = !defaultPortalExists;

    // Collect all tenant IDs to provision (invitation tenant + any additional portalAccessIds)
    const provisionTenantIds = [invite.tenantId];
    if (Array.isArray(invite.portalAccessIds) && invite.portalAccessIds.length > 0) {
      for (const tId of invite.portalAccessIds) {
        if (!provisionTenantIds.includes(tId)) {
          provisionTenantIds.push(tId);
        }
      }
    }

    // Create membership mapping(s)
    for (const tId of provisionTenantIds) {
      await UserPortalAccess.updateOne(
        { userId: user._id, tenantId: tId },
        {
          $set: {
            role: invite.role,
            customPermissions: invite.customPermissions,
            isActive: true,
            isDefaultPortal: isDefault && tId === invite.tenantId
          }
        },
        { upsert: true }
      );
    }

    await logAudit({
      tenantId: invite.tenantId,
      userId: user._id,
      action: "approve",
      entityType: "Invitation",
      entityId: invite._id,
      metadata: { action: "INVITATION_ACCEPTED", desc: `User ${invite.email} accepted invitation and joined workspace` }
    });

    res.status(200).json({
      success: true,
      message: "Invitation accepted successfully. Access granted.",
      data: {
        tenantId: invite.tenantId,
        role: invite.role
      }
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    res.status(500).json({ success: false, message: "Error accepting invitation", error: error.message });
  }
};

// @desc    Get invitation details for preview
// @route   GET /api/auth/invitation/details/:token
// @access  Public
exports.getInvitationDetails = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required." });
    }

    const crypto = require("crypto");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Check attempt limits to prevent brute-forcing
    const existingInvite = await Invitation.findOne({ token: hashedToken });
    if (existingInvite && (existingInvite.attemptCount || 0) >= 5) {
      if (existingInvite.status !== "revoked") {
        existingInvite.status = "revoked";
        await existingInvite.save();
      }
      return res.status(403).json({
        success: false,
        message: "Too many failed attempts. This invitation has been blocked/revoked for security."
      });
    }

    const invite = await Invitation.findOne({
      token: hashedToken,
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({
        success: false,
        message: "Invalid, expired, or already accepted invitation link."
      });
    }

    // Mask the email address to prevent public harvesting
    const emailParts = invite.email.split("@");
    const localPart = emailParts[0];
    const domainPart = emailParts[1];
    let maskedLocal = localPart;
    if (localPart.length > 2) {
      maskedLocal = localPart[0] + "*".repeat(localPart.length - 2) + localPart[localPart.length - 1];
    } else if (localPart.length === 2) {
      maskedLocal = localPart[0] + "*";
    }
    const emailMasked = `${maskedLocal}@${domainPart}`;

    const Tenant = require("../models/Tenant");
    const tenant = await Tenant.findOne({ tenantId: invite.tenantId });

    res.status(200).json({
      success: true,
      data: {
        emailMasked,
        portalName: tenant ? tenant.portalName : "Workspace",
      }
    });
  } catch (error) {
    console.error("Get invitation details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invitation details.",
      error: error.message
    });
  }
};
