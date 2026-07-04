const express = require("express");
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectLedger,
} = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");
const approvalInterceptor = require("../middleware/approvalInterceptor");

const Project = require("../models/Project");
const PERMISSIONS = require("../constants/permissions");

// All routes are protected
router.use(protect);

// @route   GET /api/projects
// @desc    Get all projects (for dropdown selection)
router.get("/", getAllProjects);

const checkPermission = require("../middleware/checkPermission");
router.use(checkPermission(PERMISSIONS.PROJECTS));

// @route   POST /api/projects
// @desc    Create new project
router.post("/", approvalInterceptor("create_project"), createProject);

// @route   GET /api/projects/:id/ledger
// @desc    Get project ledger with expenses and profit
router.get("/:id/ledger", getProjectLedger);

// @route   GET /api/projects/:id
// @desc    Get single project by ID
router.get("/:id", getProjectById);

// @route   PUT /api/projects/:id
// @desc    Update project
router.put("/:id", approvalInterceptor("edit_project", { model: Project }), updateProject);

// @route   DELETE /api/projects/:id
// @desc    Delete project
router.delete("/:id", approvalInterceptor("delete_project", { model: Project }), deleteProject);

module.exports = router;
