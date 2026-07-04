require("dotenv").config();
const mongoose = require("mongoose");
const GeneralLedger = require("./models/GeneralLedger");

async function recalculateBalances() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database\n");

    // Get all unique account codes
    const accounts = await GeneralLedger.distinct("accountCode");
    console.log(`Found ${accounts.length} unique accounts\n`);

    let totalUpdated = 0;

    for (const accountCode of accounts) {
      console.log(`Processing account: ${accountCode}`);

      // Get all entries for this account sorted by date
      const entries = await GeneralLedger.find({
        accountCode: accountCode,
        status: "Active",
      }).sort({ date: 1, createdAt: 1 });

      if (entries.length === 0) continue;

      const accountType = entries[0].accountType;
      let runningBalance = 0;
      let updated = 0;

      for (const entry of entries) {
        // Calculate new balance based on account type
        if (accountType === "Asset" || accountType === "Expense") {
          // Debit increases, Credit decreases
          runningBalance += entry.debit - entry.credit;
        } else {
          // Liability, Equity, Revenue - Credit increases, Debit decreases
          runningBalance += entry.credit - entry.debit;
        }

        // Update the entry if balance is different
        if (entry.balance !== runningBalance) {
          await GeneralLedger.updateOne(
            { _id: entry._id },
            { $set: { balance: runningBalance } }
          );
          updated++;
        }
      }

      console.log(`  Updated ${updated} entries for ${accountCode}`);
      console.log(`  Final balance: ${runningBalance}\n`);
      totalUpdated += updated;
    }

    console.log(`\n✅ Successfully recalculated balances`);
    console.log(`Total entries updated: ${totalUpdated}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

recalculateBalances();
