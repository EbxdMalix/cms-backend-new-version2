/**
 * Automatically injects the active tenantId into query filters.
 */
exports.scopeQuery = (req, filter = {}) => {
  if (!req.tenantId) {
    throw new Error("UNAUTHORIZED_MISSING_TENANT");
  }
  return {
    ...filter,
    tenantId: req.tenantId
  };
};
