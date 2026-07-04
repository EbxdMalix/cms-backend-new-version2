const RequestApproval = require("../models/RequestApproval");

const approvalInterceptor = (requestType, options = {}) => {
  return async (req, res, next) => {
    // Admins always bypass the approval process
    if (req.user && req.user.role === "admin") {
      return next();
    }

    try {
      let originalData = null;
      let entityId = null;

      if (options.model) {
        const idParam = options.idParam || "id";
        entityId = req.params[idParam];
        
        if (entityId) {
          try {
            const document = await options.model.findOne({ _id: entityId, tenantId: req.tenantId });
            if (document) {
              originalData = document.toObject();
            } else {
              console.warn(`Soft-fail: Document of ${options.model.modelName} not found in DB for ID: ${entityId}`);
            }
          } catch (lookupError) {
            console.error(`ERROR: Database error looking up original document for ${options.model.modelName} with ID ${entityId}:`, lookupError.message);
          }
        }
      }

      if (entityId) {
        const existingRequest = await RequestApproval.findOne({
          tenantId: req.tenantId,
          userId: req.user.id,
          entityId,
          status: "pending",
        });

        if (existingRequest) {
          return res.status(400).json({
            success: false,
            message: "You already have a pending request for this entity",
          });
        }
      }

      const structuredRequestData = req.method === "DELETE" ? {
        entityId: entityId || null,
        modelName: options.model ? options.model.modelName : "Unknown",
        action: "delete",
        reason: req.body?.reason || null,
        metadata: req.body?.metadata || null
      } : req.body;

      const request = await RequestApproval.create({
        tenantId: req.tenantId,
        userId: req.user.id,
        requestType,
        requestData: structuredRequestData,
        originalData,
        entityId: entityId || null,
      });

      return res.status(202).json({
        success: true,
        message: "Request submitted successfully. Waiting for admin approval.",
        data: request,
      });
    } catch (error) {
      console.error("Approval Interception Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error processing operation request",
        error: error.message,
      });
    }
  };
};

module.exports = approvalInterceptor;
