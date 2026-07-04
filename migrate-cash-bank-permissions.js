const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected for migration"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const User = require("./models/User");

async function migrateCashBankPermissions() {
  try {
    console.log(
      "Starting migration: cashBankPayment -> cashPayment + bankPayment"
    );

    // Find all users with customPermissions.cashBankPayment set
    const users = await User.find({
      "customPermissions.cashBankPayment": { $exists: true },
    });

    console.log(`Found ${users.length} users to migrate`);

    for (const user of users) {
      const cashBankValue = user.customPermissions.cashBankPayment;

      // Set both new permissions to the same value as the old combined one
      user.customPermissions.cashPayment = cashBankValue;
      user.customPermissions.bankPayment = cashBankValue;

      // Remove the old field
      user.customPermissions.cashBankPayment = undefined;

      await user.save();

      console.log(`✓ Migrated user: ${user.name} (${user.email})`);
      console.log(`  - cashBankPayment: ${cashBankValue}`);
      console.log(`  - New cashPayment: ${cashBankValue}`);
      console.log(`  - New bankPayment: ${cashBankValue}`);
    }

    console.log("\n✅ Migration completed successfully!");
    console.log(`Total users migrated: ${users.length}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateCashBankPermissions();
