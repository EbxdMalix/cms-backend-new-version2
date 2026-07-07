const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const { getAlerts, resolveAlert } = require("../controllers/systemAlertController");

router.get("/", protect, getAlerts);
router.put("/:id/resolve", protect, admin, resolveAlert);

module.exports = router;
