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
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/switch-portal", protect, switchPortal);
router.post("/set-default", protect, setDefaultPortal);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

module.exports = router;
