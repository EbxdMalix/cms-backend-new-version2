/**
 * NUCLEAR OPTION: Drop ALL indexes on problematic collections
 * This is the most aggressive approach - use only if other scripts fail
 *
 * This will:
 * 1. Delete ALL indexes (except _id) on affected collections
 * 2. NOT rebuild them - you'll need to restart the server to auto-create
 */

const mongoose = require("mongoose");
require("dotenv").config();

const dropAllIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Connected to MongoDB\n");

    const db = mongoose.connection.db;

    const collections = [
      "accounttypes",
      "customers",
      "suppliers",
      "items",
      "chartofaccounts",
    ];

    console.log(
      "⚠️  WARNING: This will DROP ALL INDEXES on these collections:"
    );
    console.log(`   ${collections.join(", ")}`);
    console.log(
      "\nIndexes will be automatically recreated when you restart the server."
    );
    console.log("\nProceeding with index deletion...\n");

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.getIndexes();

        console.log(`Processing ${collectionName}...`);

        for (const [indexName, indexSpec] of Object.entries(indexes)) {
          if (indexName !== "_id_") {
            await collection.dropIndex(indexName);
            console.log(`  ✓ Dropped: ${indexName}`);
          }
        }

        console.log(`  ✓ ${collectionName} complete\n`);
      } catch (err) {
        console.error(`  ✗ Error with ${collectionName}: ${err.message}\n`);
      }
    }

    console.log("✅ All indexes dropped!");
    console.log("\n📝 IMPORTANT: Restart the server now!");
    console.log("   npm start");
    console.log(
      "\nThe server will automatically create new tenant-scoped indexes."
    );

    process.exit(0);
  } catch (error) {
    console.error("✗ Failed:", error);
    process.exit(1);
  }
};

dropAllIndexes();
