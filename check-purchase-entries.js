require("dotenv").config();
const mongoose = require("mongoose");
const GeneralLedger = require("./models/GeneralLedger");

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to database\n");

    // Find the latest purchase journal entry
    const entries = await GeneralLedger.find({
      transactionType: "Purchase",
    })
      .sort({ date: -1 })
      .limit(10);

    if (entries.length > 0) {
      console.log("Latest Purchase General Ledger Entries:\n");

      // Group by entry number
      const grouped = {};
      entries.forEach((e) => {
        if (!grouped[e.entryNumber]) {
          grouped[e.entryNumber] = [];
        }
        grouped[e.entryNumber].push(e);
      });

      // Display each journal entry
      for (const [entryNum, lines] of Object.entries(grouped)) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Journal Entry: ${entryNum}`);
        console.log(`Date: ${lines[0].date.toISOString().split("T")[0]}`);
        console.log(`Description: ${lines[0].description}`);
        console.log(`${"=".repeat(60)}\n`);

        console.log("Account Name".padEnd(30) + "Debit".padEnd(15) + "Credit");
        console.log("-".repeat(60));

        let totalDebit = 0;
        let totalCredit = 0;

        lines.forEach((line) => {
          const debitStr =
            line.debit > 0 ? `Rs. ${line.debit.toLocaleString()}` : "-";
          const creditStr =
            line.credit > 0 ? `Rs. ${line.credit.toLocaleString()}` : "-";
          console.log(
            `${line.accountName.padEnd(30)}${debitStr.padEnd(15)}${creditStr}`
          );
          totalDebit += line.debit;
          totalCredit += line.credit;
        });

        console.log("-".repeat(60));
        console.log(
          `${"TOTALS".padEnd(30)}Rs. ${totalDebit.toLocaleString()}`.padEnd(
            45
          ) + `Rs. ${totalCredit.toLocaleString()}`
        );
        console.log(
          `\n✓ Balanced: ${totalDebit === totalCredit ? "YES" : "NO"}\n`
        );
      }
    } else {
      console.log("No purchase entries found");
    }

    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
