const express = require("express");
const router = express.Router();
const {
  getAllPlots,
  getPlotById,
  createPlot,
  updatePlot,
  deletePlot,
  getPlotsByProject,
  getPlotSummary,
} = require("../controllers/plotController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const Plot = require("../models/Plot");
const PERMISSIONS = require("../constants/permissions");

// All routes require authentication
router.use(protect);
const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.PLOTS));

// Summary route (must be before /:id)
router.get("/summary", getPlotSummary);

// Project-specific route
router.get("/project/:projectId", getPlotsByProject);

// Main routes
router.route("/")
  .get(getAllPlots)
  .post(approvalInterceptor("create_plot"), createPlot);

// Individual plot routes
router.route("/:id")
  .get(getPlotById)
  .put(approvalInterceptor("edit_plot", { model: Plot }), updatePlot)
  .delete(approvalInterceptor("delete_plot", { model: Plot }), deletePlot);

module.exports = router;
