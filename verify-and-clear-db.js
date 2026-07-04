require("dotenv").config();
const mongoose = require("mongoose");

async function verifyAndClearDatabase() {
  try {
    // Connect to MongoDB
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log("\n📊 Current collections:");
    if (collections.length === 0) {
      console.log("   ✓ Database is EMPTY - No collections found");
    } else {
      collections.forEach((col) => {
        console.log(`   - ${col.name}`);
      });
    }

    // Drop all collections
    console.log("\n🗑️  Dropping all collections...");
    for (const col of collections) {
      try {
        await db.dropCollection(col.name);
        console.log(`   ✓ Dropped ${col.name}`);
      } catch (error) {
        console.log(`   ⚠ Could not drop ${col.name}: ${error.message}`);
      }
    }

    // Verify collections are dropped
    console.log("\n✓ Verifying database is empty...");
    const collectionsAfter = await db.listCollections().toArray();
    if (collectionsAfter.length === 0) {
      console.log("   ✓ Database is COMPLETELY EMPTY");
      console.log("\n✅ Database cleared successfully!");
      console.log("\nNext steps:");
      console.log("1. POST to /api/tenant/register to create a portal");
      console.log("2. Then login and create data");
    } else {
      console.log("   ⚠ Warning: Some collections still exist:");
      collectionsAfter.forEach((col) => {
        console.log(`     - ${col.name}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

verifyAndClearDatabase();
