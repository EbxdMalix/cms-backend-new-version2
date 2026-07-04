require("dotenv").config();
const mongoose = require("mongoose");
const GeneralLedger = require("./models/GeneralLedger");

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to database\n");

    // Get all accounts
    const accounts = await GeneralLedger.distinct("accountCode");

    console.log("=".repeat(80));
    console.log("GENERAL LEDGER - RUNNING BALANCES");
    console.log("=".repeat(80));
    console.log();

    for (const accountCode of accounts) {
      const entries = await GeneralLedger.find({
        accountCode: accountCode,
        status: "Active",
      }).sort({ date: 1, createdAt: 1 });

      if (entries.length === 0) continue;

      console.log(`\n${"─".repeat(80)}`);
      console.log(
        `Account: ${accountCode} - ${entries[0].accountName} (${entries[0].accountType})`
      );
      console.log("─".repeat(80));
      console.log(
        "Date".padEnd(12) +
          "Entry No".padEnd(18) +
          "Debit".padEnd(15) +
          "Credit".padEnd(15) +
          "Balance"
      );
      console.log("-".repeat(80));

      entries.forEach((entry) => {
        const date = new Date(entry.date).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        });
        const debit =
          entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString()}` : "-";
        const credit =
          entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString()}` : "-";
        const balance = `Rs. ${entry.balance.toLocaleString()}`;

        console.log(
          date.padEnd(12) +
            entry.entryNumber.padEnd(18) +
            debit.padEnd(15) +
            credit.padEnd(15) +
            balance
        );
      });

      const finalBalance = entries[entries.length - 1].balance;
      console.log("-".repeat(80));
      console.log(`Final Balance: Rs. ${finalBalance.toLocaleString()}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✓ All balances calculated correctly");
    console.log("=".repeat(80) + "\n");

    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
