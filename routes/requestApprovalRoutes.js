const express = require("express");
const router = express.Router();
const {
  createRequest,
  getMyRequests,
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  deleteRequest,
  getRequestStats,
} = require("../controllers/requestApprovalController");
const { protect, admin } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// User routes - accessible to all authenticated users
router.post("/", createRequest); // Create a new request
router.get("/my-requests", getMyRequests); // Get user's own requests

// Admin routes - only accessible to admins
router.get("/pending", admin, getPendingRequests); // Get all pending requests
router.get("/stats", admin, getRequestStats); // Get request statistics
router.get("/", admin, getAllRequests); // Get all requests with optional filtering
router.put("/:id/approve", admin, approveRequest); // Approve a request
router.put("/:id/reject", admin, rejectRequest); // Reject a request
router.delete("/:id", deleteRequest); // Delete a request (admin or owner)

module.exports = router;
