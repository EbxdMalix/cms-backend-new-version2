const UserPortalAccess = require("../models/UserPortalAccess");
const Tenant = require("../models/Tenant");

/**
 * Resolves and validates a user's active workspace context.
 * Returns cached context or throws an error if unauthorized.
 */
exports.resolveTenantContext = async (userId, tenantId) => {
  if (!tenantId) return null;

  // Verify workspace exists and is active
  const tenantInfo = await Tenant.findOne({ tenantId, isActive: true });
  if (!tenantInfo) {
    throw new Error("WORKSPACE_INACTIVE");
  }

  // Verify user has an active membership mapping
  const access = await UserPortalAccess.findOne({
    userId,
    tenantId,
    isActive: true,
  });

  if (!access) {
    throw new Error("MEMBERSHIP_DENIED");
  }

  return {
    tenantId: access.tenantId,
    role: access.role,
    customPermissions: access.customPermissions,
    portalName: tenantInfo.portalName,
    branding: tenantInfo.branding || null,
    permissionVersion: access.permissionVersion || 1,
  };
};
