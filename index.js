require("dotenv").config();

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in environment variables");
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const ensureDbConnection = require("./middleware/dbConnection");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// ============================================
// SECURITY & OBSERVABILITY MIDDLEWARE CONFIGURATION
// ============================================

// 1. Request ID generator (Runs before any logging or routing)
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
});

// 2. Structured request logger (skipping OPTIONS to prevent Vercel log spam)
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    if (req.method !== "OPTIONS") {
      console.log(JSON.stringify({
        version: "1",
        level: "info",
        message: "Request completed",
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        durationMs: Date.now() - start,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      }));
    }
  });

  if (req.method !== "OPTIONS") {
    console.log(JSON.stringify({
      version: "1",
      level: "info",
      message: "Request received",
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    }));
  }

  next();
});

// CORS origin configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  process.env.FRONTEND_URL,
]
  .filter(Boolean)
  .map((url) => url.trim().replace(/\/$/, ""));

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("CORS blocked origin:", origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id", "x-request-id"],
  credentials: true,
  optionsSuccessStatus: 204,
};

// 3. CORS configuration
app.use(cors(corsOptions));

// Explicitly handle and terminate any remaining OPTIONS requests to prevent fall-through and 504 timeouts
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// Set security HTTP headers using Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    xssFilter: true,
    noSniff: true,
    ieNoOpen: true,
    hidePoweredBy: true,
  })
);

// General rate limiter to prevent DDoS / brute-force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per window
  standardHeaders: true, // Return rate limit info in standard headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  validate: false,
  skip: (req) => req.method === "OPTIONS" || process.env.NODE_ENV === "development", // Skip CORS preflights and development env from limits
  keyGenerator: (req) => {
    const rawIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.ip || "127.0.0.1";
    return rawIp.split(",")[0].trim();
  },
  message: {
    error: "Too Many Requests",
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});
app.use(limiter);

// 4. Body parser with size limits (1mb for Vercel compliance)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Cookie parser for secure cookie handling
app.use(cookieParser());

// Initialize request-scoped AsyncLocalStorage for multi-tenant isolation
const tenantLocalStorage = require("./utils/tenantStorage");
app.use((req, res, next) => {
  tenantLocalStorage.run(new Map(), () => {
    next();
  });
});

// Data sanitization against NoSQL query injection
app.use((req, res, next) => {
  const sanitizeObject = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.replace(/^\$+/, "");

      if (typeof value === "object" && value !== null) {
        sanitized[sanitizedKey] = sanitizeObject(value);
      } else if (typeof value === "string") {
        sanitized[sanitizedKey] = value.replace(/\$/g, "");
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  };

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }

  if (req.query && typeof req.query === "object") {
    req.sanitizedQuery = sanitizeObject(req.query);
  }

  next();
});

// Data sanitization against XSS attacks
app.use((req, res, next) => {
  const sanitizeXSS = (value) => {
    if (typeof value === "string") {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
    }
    return value;
  };

  const sanitizeObjectXSS = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeObjectXSS(value);
      } else {
        sanitized[key] = sanitizeXSS(value);
      }
    }

    return sanitized;
  };

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObjectXSS(req.body);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObjectXSS(req.params);
  }

  if (req.query && typeof req.query === "object" && !req.sanitizedQuery) {
    req.sanitizedQuery = sanitizeObjectXSS(req.query);
  } else if (req.sanitizedQuery) {
    req.sanitizedQuery = sanitizeObjectXSS(req.sanitizedQuery);
  }

  next();
});

// Prevent HTTP Parameter Pollution attacks
app.use((req, res, next) => {
  if (req.sanitizedQuery && typeof req.sanitizedQuery === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(req.sanitizedQuery)) {
      cleaned[key] = Array.isArray(value) ? value[value.length - 1] : value;
    }
    req.sanitizedQuery = cleaned;
  }

  next();
});

// Log environment check
console.log("Environment check:", {
  hasMongoUri: !!process.env.MONGODB_URI,
  hasJwtSecret: !!process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV,
  port: PORT,
  frontendUrl: process.env.FRONTEND_URL,
});

console.log(
  "CORS allowed origins:",
  [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
  ].filter(Boolean)
);

// Apply database connection middleware to all routes
app.use(ensureDbConnection);

// Apply Clerk middleware globally to parse authentication headers
const { clerkMiddleware } = require("@clerk/express");
app.use(clerkMiddleware());

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const projectRoutes = require("./routes/projectRoutes");
const customerRoutes = require("./routes/customerRoutes");
const chartOfAccountRoutes = require("./routes/chartOfAccountRoutes");
const bankPaymentRoutes = require("./routes/bankPaymentRoutes");
const itemRoutes = require("./routes/itemRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const salesInvoiceRoutes = require("./routes/salesInvoiceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const accountTypeRoutes = require("./routes/accountTypeRoutes");
const reportRoutes = require("./routes/reportRoutes");
const journalEntryRoutes = require("./routes/journalEntryRoutes");
const generalLedgerRoutes = require("./routes/generalLedgerRoutes");
const cashPaymentRoutes = require("./routes/cashPaymentRoutes");
const plotRoutes = require("./routes/plotRoutes");
const requestApprovalRoutes = require("./routes/requestApprovalRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/chartofaccounts", chartOfAccountRoutes);
app.use("/api/bankpayments", bankPaymentRoutes);
app.use("/api/cashpayments", cashPaymentRoutes);
app.use("/api/plots", plotRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/sales-invoices", salesInvoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/account-types", accountTypeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/journal-entries", journalEntryRoutes);
app.use("/api/general-ledger", generalLedgerRoutes);
app.use("/api/request-approvals", requestApprovalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/system-alerts", require("./routes/systemAlertRoutes"));

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Construction Management System API",
    status: "Server is running",
    version: "1.0.0",
    documentation: "Visit /api for available endpoints",
    endpoints: {
      api: "/api",
      test: "/api/test",
      health: "/api/health",
    },
  });
});

// API base route
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Construction Management System API",
    status: "Server is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      projects: "/api/projects",
      customers: "/api/customers",
      chartofaccounts: "/api/chartofaccounts",
      bankpayments: "/api/bankpayments",
      cashpayments: "/api/cashpayments",
      items: "/api/items",
      purchases: "/api/purchases",
      suppliers: "/api/suppliers",
      salesInvoices: "/api/sales-invoices",
      dashboard: "/api/dashboard",
      accountTypes: "/api/account-types",
      reports: "/api/reports",
      journalEntries: "/api/journal-entries",
      generalLedger: "/api/general-ledger",
      requestApprovals: "/api/request-approvals",
    },
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "API is working",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  const isConnected = mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "healthy" : "unhealthy",
    database: isConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.url} not found`,
    availableEndpoints: {
      api: "/api",
      test: "/api/test",
      health: "/api/health",
      auth: "/api/auth",
      users: "/api/users",
      projects: "/api/projects",
      customers: "/api/customers",
      chartofaccounts: "/api/chartofaccounts",
      bankpayments: "/api/bankpayments",
      cashpayments: "/api/cashpayments",
      items: "/api/items",
      purchases: "/api/purchases",
      suppliers: "/api/suppliers",
      salesInvoices: "/api/sales-invoices",
      dashboard: "/api/dashboard",
      accountTypes: "/api/account-types",
      reports: "/api/reports",
      journalEntries: "/api/journal-entries",
      generalLedger: "/api/general-ledger",
    },
  });
});

// Centralized Production Error Boundary Middleware
app.use(async (err, req, res, next) => {
  const errorPayload = {
    version: "1",
    level: "error",
    message: err.message,
    requestId: req.id,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    timestamp: new Date().toISOString()
  };
  console.error(JSON.stringify(errorPayload));

  // Bypass DB writes for CORS and Rate Limiting errors to prevent DB exhaustion and 504 timeouts
  const isCorsError = err.message && err.message.includes("Not allowed by CORS");
  const isRateLimitError = err.status === 429 || err.statusCode === 429;

  if (!isCorsError && !isRateLimitError) {
    try {
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState !== 1) {
        const connectDB = require("./db/db");
        await connectDB();
      }

      const SystemAlertService = require("./services/systemAlertService");
      const crypto = require("crypto");
      const fingerprint = crypto
        .createHash("md5")
        .update(`${err.code || ""}:${err.message?.slice(0, 100) || "unknown"}:${req.method || ""}:${req.path || ""}`)
        .digest("hex");

      await SystemAlertService.create({
        tenantId: req.tenantId,
        severity: err.status >= 500 ? "error" : "warning",
        type: err.status === 429 ? "API_ERROR" : err.status >= 500 ? "API_ERROR" : "VALIDATION_ERROR",
        fingerprint,
        title: `${req.method} ${req.path} — ${err.status || 500}`,
        message: err.message,
        stackTrace: err.stack,
        endpoint: req.originalUrl,
        method: req.method,
        userId: req.user?._id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { requestId: req.id, statusCode: err.status || 500, code: err.code },
      });
    } catch (alertErr) {
      console.error("SystemAlert creation failed:", alertErr.message);
    }
  } else {
    console.warn(`Bypassed DB system alert logging for: ${isCorsError ? "CORS error" : "Rate limit error"} — ${err.message}`);
  }

  res.status(err.status || 500).json({
    success: false,
    requestId: req.id,
    error: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message
  });
});

// Process-level error handlers (fire-and-forget; don't prevent Vercel cold start)
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT_EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED_REJECTION:", reason);
});

// Export the Express app for Vercel serverless
module.exports = app;

// Start server only in non-serverless environment (local development)
if (process.env.NODE_ENV !== "production" || process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV}`);
  });
}
// Auto-restart hook
