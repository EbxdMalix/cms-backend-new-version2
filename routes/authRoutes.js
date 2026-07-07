const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  switchPortal,
  setDefaultPortal,
  updateProfile,
  changePassword,
} = require("../controllers/authController");
const { syncClerkUser } = require("../controllers/clerkSyncController");
const { acceptInvitation, getInvitationDetails } = require("../controllers/invitationController");
const { protect } = require("../middleware/authMiddleware");
const { inviteAuthLimiter, tenantSwitchLimiter } = require("../middleware/rateLimiters");

// Public routes
router.post("/register", register);
router.post("/login", login);
router.get("/invitation/details/:token", inviteAuthLimiter, getInvitationDetails);
router.post("/invitation/accept", inviteAuthLimiter, acceptInvitation);

// Protected routes
router.get("/me", protect, getMe);
router.get("/clerk-sync", syncClerkUser);
router.post("/logout", protect, logout);
router.post("/switch-portal", protect, tenantSwitchLimiter, switchPortal);
router.post("/set-default", protect, setDefaultPortal);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

module.exports = router;
