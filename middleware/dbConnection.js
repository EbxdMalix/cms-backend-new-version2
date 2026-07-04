const connectDB = require("../db/db");

// Middleware to ensure database connection before handling requests
const ensureDbConnection = async (req, res, next) => {
  // Bypass DB connection checks for CORS preflight (OPTIONS) requests
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({
      error: "Service Unavailable",
      message: "Database connection failed. Please try again later.",
    });
  }
};

module.exports = ensureDbConnection;
