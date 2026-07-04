const express = require("express");
const router = express.Router();
const tenantController = require("../controllers/tenantController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", tenantController.registerTenant);
router.get("/all", tenantController.getAllTenants);

// Protected routes (must be before dynamic routes)
router.get("/current/info", protect, tenantController.getTenant);
router.put("/update-settings", protect, tenantController.updateTenant);

// Dynamic routes (must be last)
router.get("/:tenantId", tenantController.getTenantById);

module.exports = router;
