const mongoose = require("mongoose");
const dns = require("dns");

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("Warning: Could not set global DNS servers, falling back to system defaults:", err.message);
}

let isConnected = false;

// Global insert logger plugin
mongoose.plugin((schema) => {
  schema.post("save", function (doc) {
    console.log(JSON.stringify({
      version: "1",
      level: "info",
      message: "Database document saved",
      model: doc.constructor.modelName || doc.modelName,
      id: doc._id,
      timestamp: new Date().toISOString()
    }));
  });
});

const connectDB = async () => {
  // If already connected, return the existing connection
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log("✓ Using existing MongoDB connection");
    return mongoose.connection;
  }

  // If connection is in progress, wait for it
  if (mongoose.connection.readyState === 2) {
    console.log("⏳ Connection already in progress, waiting...");
    isConnected = false;
    return new Promise((resolve, reject) => {
      mongoose.connection.once("connected", () => {
        isConnected = true;
        resolve(mongoose.connection);
      });
      mongoose.connection.once("error", (err) => {
        isConnected = false;
        reject(err);
      });
    });
  }

  try {
    // Prioritize MONGODB_URI to avoid legacy env variable hijack
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MongoDB URI is not defined in environment variables");
    }

    // Configure mongoose for serverless environment
    mongoose.set("strictQuery", false);
    mongoose.set("bufferCommands", false); // Disable buffering for serverless

    const connection = await mongoose.connect(mongoUri, {
      dbName: "construction-system", // Enforce database namespace
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    isConnected = true;
    console.log("✓ MongoDB connected successfully");
    console.log(`✓ Database: ${mongoose.connection.name}`);
    return connection;
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    console.error("✗ Please check your MONGODB_URI environment variable");
    console.error(
      "✗ Make sure to whitelist 0.0.0.0/0 in MongoDB Atlas Network Access"
    );
    isConnected = false;
    throw error; // Don't exit process in serverless environment
  }
};

// Handle connection events
mongoose.connection.on("connected", () => {
  isConnected = true;
  console.log("✓ Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  isConnected = false;
  console.error("✗ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("⚠ Mongoose disconnected from MongoDB");
});

module.exports = connectDB;
