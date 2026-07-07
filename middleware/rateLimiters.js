const rateLimit = require("express-rate-limit");

// Strict rate limiter for public invitation lookup and acceptance to prevent token brute-forcing
exports.inviteAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit to 15 attempts
  skip: () => process.env.NODE_ENV === "development",
  validate: { ip: false },
  message: {
    success: false,
    message: "Too many access attempts. Please try again in 15 minutes."
  }
});

// Rate limiter for creating and dispatching new email invitations to prevent email API abuse/spamming
exports.inviteDispatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit to 30 dispatches
  skip: () => process.env.NODE_ENV === "development",
  validate: { ip: false },
  message: {
    success: false,
    message: "Rate limit exceeded for invitation dispatches. Please wait 15 minutes."
  }
});

// Rate limiter for tenant switching requests to prevent database/session flood attacks
exports.tenantSwitchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // Limit to 40 switches
  skip: () => process.env.NODE_ENV === "development",
  validate: { ip: false },
  message: {
    success: false,
    message: "Too many workspace switch attempts. Please try again later."
  }
});

// General API rate limiter for general dashboard queries to prevent DoS (100 requests per 1 minute)
exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit to 100 requests
  skip: () => process.env.NODE_ENV === "development",
  validate: { ip: false },
  message: {
    success: false,
    message: "Rate limit exceeded. Please try again in a minute."
  }
});

// Strict rate limiter for sensitive reporting, ledger audit runs, and data exports (20 requests per 1 minute)
exports.sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit to 20 requests
  skip: () => process.env.NODE_ENV === "development",
  validate: { ip: false },
  message: {
    success: false,
    message: "Too many operations on sensitive ledger data. Please try again in a minute."
  }
});
