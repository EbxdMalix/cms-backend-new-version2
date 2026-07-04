const JournalEntry = require("../models/JournalEntry");
const GeneralLedger = require("../models/GeneralLedger");
const ChartOfAccount = require("../models/ChartOfAccount");

/**
 * Accounting Service - Handles all double-entry bookkeeping operations
 */
class AccountingService {
  /**
   * Create a journal entry and post to general ledger
   * @param {Object} entryData - Journal entry data
   * @param {String} userId - ID of the user creating the entry
   * @returns {Promise<Object>} Created journal entry
   */
  static async createJournalEntry(entryData, userId) {
    const session = await JournalEntry.startSession();
    session.startTransaction();

    try {
      // Validate that debits equal credits
      const totalDebit = entryData.lines.reduce(
        (sum, line) => sum + (line.debit || 0),
        0
      );
      const totalCredit = entryData.lines.reduce(
        (sum, line) => sum + (line.credit || 0),
        0
      );

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
          `Journal entry is not balanced. Debits (${totalDebit}) must equal Credits (${totalCredit})`
        );
      }

      // Create journal entry with calculated totals
      const journalEntry = await JournalEntry.create(
        [
          {
            ...entryData,
            totalDebit,
            totalCredit,
            createdBy: userId,
            isPosted: true,
            status: "Posted",
          },
        ],
        { session }
      );

      // Post to general ledger if status is Posted
      if (journalEntry[0].isPosted) {
        await this.postToGeneralLedger(journalEntry[0], session);
      }

      await session.commitTransaction();
      return journalEntry[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Post journal entry to general ledger
   * @param {Object} journalEntry - Journal entry document
   * @param {Object} session - Mongoose session for transaction
   */
  static async postToGeneralLedger(journalEntry, session = null) {
    const ledgerEntries = [];

    for (const line of journalEntry.lines) {
      // Get the previous balance for this account
      const previousEntry = await GeneralLedger.findOne({
        tenantId: journalEntry.tenantId,
        accountCode: line.accountCode,
        status: "Active",
      })
        .sort({ date: -1, createdAt: -1 })
        .session(session);

      const previousBalance = previousEntry ? previousEntry.balance : 0;

      // Calculate new running balance based on account type
      // Asset, Expense: Debit increases, Credit decreases
      // Liability, Equity, Revenue: Credit increases, Debit decreases
      let newBalance = previousBalance;
      if (line.accountType === "Asset" || line.accountType === "Expense") {
        newBalance = previousBalance + (line.debit || 0) - (line.credit || 0);
      } else {
        // Liability, Equity, Revenue
        newBalance = previousBalance + (line.credit || 0) - (line.debit || 0);
      }

      const ledgerEntry = {
        account: line.account,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
        date: journalEntry.date,
        journalEntry: journalEntry._id,
        entryNumber: journalEntry.entryNumber,
        description: line.description || journalEntry.description,
        transactionType: journalEntry.transactionType,
        project: journalEntry.project,
        debit: line.debit || 0,
        credit: line.credit || 0,
        balance: newBalance,
        sourceTransaction: journalEntry.sourceTransaction,
        status: "Active",
      };

      ledgerEntries.push(ledgerEntry);
    }

    if (session) {
      await GeneralLedger.insertMany(ledgerEntries, { session });
    } else {
      await GeneralLedger.insertMany(ledgerEntries);
    }
  }

  /**
   * Create journal entry for a sales transaction
   * Properly handles partial payments:
   * - Debit: Cash Account (amount received)
   * - Debit: Accounts Receivable (balance due)
   * - Credit: Sales Revenue (total amount)
   */
  static async createSalesJournalEntry(salesInvoice, userId) {
    // Determine accounts
    const revenueAccount = await this.getOrCreateAccount(
      salesInvoice.tenantId,
      "4000",
      "Sales Revenue",
      "Revenue"
    );
    const receivableAccount = await this.getOrCreateAccount(
      salesInvoice.tenantId,
      "1200",
      "Accounts Receivable",
      "Asset"
    );
    const cashAccount = await this.getOrCreateAccount(
      salesInvoice.tenantId,
      "1000",
      "Cash Account",
      "Asset"
    );

    const lines = [];

    // If cash received, debit cash account
    if (salesInvoice.amountReceived > 0) {
      lines.push({
        account: cashAccount._id,
        accountCode: cashAccount.code || "1000",
        accountName: cashAccount.name || "Cash Account",
        accountType: "Asset",
        debit: salesInvoice.amountReceived,
        credit: 0,
        description: `Cash received from ${salesInvoice.customerName}`,
      });
    }

    // If balance due, debit accounts receivable
    if (salesInvoice.balance > 0) {
      lines.push({
        account: receivableAccount._id,
        accountCode: receivableAccount.code || "1200",
        accountName: receivableAccount.name || "Accounts Receivable",
        accountType: "Asset",
        debit: salesInvoice.balance,
        credit: 0,
        description: `Balance due from ${salesInvoice.customerName}`,
      });
    }

    // Credit revenue account for full amount
    lines.push({
      account: revenueAccount._id,
      accountCode: revenueAccount.code || "4000",
      accountName: revenueAccount.name || "Sales Revenue",
      accountType: "Revenue",
      debit: 0,
      credit: salesInvoice.netTotal,
      description: `Sales revenue from Invoice ${salesInvoice.serialNo}`,
    });

    const entryData = {
      date: salesInvoice.date,
      transactionType: "Sale",
      sourceTransaction: {
        model: "SalesInvoice",
        id: salesInvoice._id,
        reference: salesInvoice.serialNo,
      },
      project: salesInvoice.project,
      description: `Sales Invoice ${salesInvoice.serialNo} - ${salesInvoice.customerName}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Create journal entry for a purchase transaction
   */
  static async createPurchaseJournalEntry(purchase, userId) {
    // Determine accounts
    const inventoryAccount = await this.getOrCreateAccount(
      purchase.tenantId,
      "1300",
      "Inventory",
      "Asset"
    );
    const payableAccount = await this.getOrCreateAccount(
      purchase.tenantId,
      "2000",
      "Accounts Payable",
      "Liability"
    );

    const lines = [
      {
        account: inventoryAccount._id,
        accountCode: inventoryAccount.code || "1300",
        accountName: inventoryAccount.name || "Inventory",
        accountType: "Asset",
        debit: purchase.netAmount,
        credit: 0,
        description: `Purchase of ${purchase.itemName}`,
      },
      {
        account: payableAccount._id,
        accountCode: payableAccount.code || "2000",
        accountName: payableAccount.name || "Accounts Payable",
        accountType: "Liability",
        debit: 0,
        credit: purchase.netAmount,
        description: `Purchase from ${purchase.vendorName}`,
      },
    ];

    const entryData = {
      date: purchase.date,
      transactionType: "Purchase",
      sourceTransaction: {
        model: "Purchase",
        id: purchase._id,
        reference: purchase.purchaseOrderNo,
      },
      project: purchase.project,
      description: `Purchase Order ${purchase.purchaseOrderNo} - ${purchase.vendorName}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Create journal entry for a bank payment
   */
  static async createBankPaymentJournalEntry(bankPayment, userId) {
    const bankAccount = await this.getOrCreateAccount(
      bankPayment.tenantId,
      "1100",
      `Bank - ${bankPayment.bankAccount}`,
      "Asset"
    );

    const lines = [];

    // Credit bank account (money out)
    lines.push({
      account: bankAccount._id,
      accountCode: bankAccount.code || "1100",
      accountName: bankAccount.name || `Bank - ${bankPayment.bankAccount}`,
      accountType: "Asset",
      debit: 0,
      credit: bankPayment.totalAmount,
      description: `Payment via ${bankPayment.bankAccount}`,
    });

    // Debit expense accounts based on payment lines
    for (const paymentLine of bankPayment.paymentLines) {
      // Try to find the account or create a default expense account
      let expenseAccount;
      try {
        expenseAccount = await ChartOfAccount.findOne({
          tenantId: bankPayment.tenantId,
          code: paymentLine.accountCode,
        });
        if (!expenseAccount) {
          expenseAccount = await this.getOrCreateAccount(
            bankPayment.tenantId,
            paymentLine.accountCode,
            paymentLine.accountName,
            "Expense"
          );
        }
      } catch (error) {
        expenseAccount = await this.getOrCreateAccount(
          bankPayment.tenantId,
          paymentLine.accountCode,
          paymentLine.accountName,
          "Expense"
        );
      }

      lines.push({
        account: expenseAccount._id,
        accountCode: paymentLine.accountCode,
        accountName: paymentLine.accountName,
        accountType: "Expense",
        debit: paymentLine.amount,
        credit: 0,
        description: paymentLine.description || `Expense payment`,
      });
    }

    const entryData = {
      date: bankPayment.date,
      transactionType: "Payment",
      sourceTransaction: {
        model: "BankPayment",
        id: bankPayment._id,
        reference: bankPayment.serialNo,
      },
      project: bankPayment.project,
      description: `Bank Payment ${bankPayment.serialNo} - ${bankPayment.bankAccount}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Create journal entry for a cash payment
   */
  static async createCashPaymentJournalEntry(cashPayment, userId) {
    const cashAccount = await this.getOrCreateAccount(
      cashPayment.tenantId,
      "1000",
      "Cash Account",
      "Asset"
    );

    const lines = [];

    // Credit cash account (money out)
    lines.push({
      account: cashAccount._id,
      accountCode: cashAccount.code || "1000",
      accountName: cashAccount.name || "Cash Account",
      accountType: "Asset",
      debit: 0,
      credit: cashPayment.totalAmount,
      description: `Cash payment`,
    });

    // Debit expense accounts based on payment lines
    for (const paymentLine of cashPayment.paymentLines) {
      // Try to find the account or create a default expense account
      let expenseAccount;
      try {
        expenseAccount = await ChartOfAccount.findOne({
          tenantId: cashPayment.tenantId,
          code: paymentLine.accountCode,
        });
        if (!expenseAccount) {
          expenseAccount = await this.getOrCreateAccount(
            cashPayment.tenantId,
            paymentLine.accountCode,
            paymentLine.accountName,
            "Expense"
          );
        }
      } catch (error) {
        expenseAccount = await this.getOrCreateAccount(
          cashPayment.tenantId,
          paymentLine.accountCode,
          paymentLine.accountName,
          "Expense"
        );
      }

      lines.push({
        account: expenseAccount._id,
        accountCode: paymentLine.accountCode,
        accountName: paymentLine.accountName,
        accountType: "Expense",
        debit: paymentLine.amount,
        credit: 0,
        description: paymentLine.description || `Expense payment`,
      });
    }

    const entryData = {
      date: cashPayment.date,
      transactionType: "Payment",
      sourceTransaction: {
        model: "CashPayment",
        id: cashPayment._id,
        reference: cashPayment.serialNo,
      },
      project: cashPayment.project,
      description: `Cash Payment ${cashPayment.serialNo}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Create payment receipt journal entry (when customer pays)
   * This reduces accounts receivable and increases cash/bank
   */
  static async createPaymentReceiptEntry(payment, userId) {
    const paymentAccount =
      payment.paymentMethod === "Cash"
        ? await this.getOrCreateAccount(payment.tenantId, "1000", "Cash Account", "Asset")
        : await this.getOrCreateAccount(
            payment.tenantId,
            "1100",
            `Bank - ${payment.bankName || "Account"}`,
            "Asset"
          );

    const receivableAccount = await this.getOrCreateAccount(
      payment.tenantId,
      "1200",
      "Accounts Receivable",
      "Asset"
    );

    const lines = [
      {
        account: paymentAccount._id,
        accountCode: paymentAccount.code,
        accountName: paymentAccount.name,
        accountType: "Asset",
        debit: payment.amount,
        credit: 0,
        description: `Payment received from ${payment.customerName}`,
      },
      {
        account: receivableAccount._id,
        accountCode: receivableAccount.code || "1200",
        accountName: receivableAccount.name || "Accounts Receivable",
        accountType: "Asset",
        debit: 0,
        credit: payment.amount,
        description: `Payment against Invoice ${payment.invoiceRef || ""}`,
      },
    ];

    const entryData = {
      date: payment.date || new Date(),
      transactionType: "Receipt",
      sourceTransaction: {
        model: "Manual",
        reference: payment.reference,
      },
      description: `Payment receipt from ${payment.customerName}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Create supplier payment journal entry (when paying supplier)
   * This reduces accounts payable and decreases cash/bank
   */
  static async createSupplierPaymentEntry(payment, userId) {
    const paymentAccount =
      payment.paymentMethod === "Cash"
        ? await this.getOrCreateAccount(payment.tenantId, "1000", "Cash Account", "Asset")
        : await this.getOrCreateAccount(
            payment.tenantId,
            "1100",
            `Bank - ${payment.bankName || "Account"}`,
            "Asset"
          );

    const payableAccount = await this.getOrCreateAccount(
      payment.tenantId,
      "2000",
      "Accounts Payable",
      "Liability"
    );

    const lines = [
      {
        account: payableAccount._id,
        accountCode: payableAccount.code || "2000",
        accountName: payableAccount.name || "Accounts Payable",
        accountType: "Liability",
        debit: payment.amount,
        credit: 0,
        description: `Payment to ${payment.supplierName}`,
      },
      {
        account: paymentAccount._id,
        accountCode: paymentAccount.code,
        accountName: paymentAccount.name,
        accountType: "Asset",
        debit: 0,
        credit: payment.amount,
        description: `Payment to supplier via ${payment.paymentMethod}`,
      },
    ];

    const entryData = {
      date: payment.date || new Date(),
      transactionType: "Payment",
      sourceTransaction: {
        model: "Manual",
        reference: payment.reference,
      },
      description: `Payment to supplier ${payment.supplierName}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Helper method to get or create a chart of account
   * Handles both main accounts and sub-accounts
   */
  static async getOrCreateAccount(tenantId, code, name, type) {
    // First try to find as a main account
    let account = await ChartOfAccount.findOne({ tenantId, code: code });

    if (!account) {
      // Try to find as a sub-account or list account
      const parentAccount = await ChartOfAccount.findOne({
        tenantId,
        $or: [{ "subAccounts.code": code }, { "listAccounts.code": code }],
      });

      if (parentAccount) {
        // Return the parent account - it contains the sub-account
        return parentAccount;
      }

      // If still not found, create a new account
      account = await ChartOfAccount.create({
        tenantId,
        code: code,
        name: name,
        accountType: type,
        mainAccountType: null,
        mainTypeCode: code,
        mainAccountTypeText: name,
        financialComponent: this.getFinancialComponent(type),
        subAccounts: [],
        listAccounts: [],
      });
    }

    return account;
  }

  /**
   * Map account type to financial component
   */
  static getFinancialComponent(accountType) {
    const mapping = {
      Asset: "Assets",
      Liability: "Liabilities",
      Equity: "Equity",
      Revenue: "Operating Income",
      Expense: "Operating Expenses",
    };
    return mapping[accountType] || "Other";
  }

  /**
   * Get account balance
   */
  static async getAccountBalance(accountCode, asOfDate = new Date()) {
    return await GeneralLedger.getAccountBalance(accountCode, asOfDate);
  }

  /**
   * Get account ledger
   */
  static async getAccountLedger(accountCode, startDate, endDate) {
    return await GeneralLedger.getAccountLedger(
      accountCode,
      startDate,
      endDate
    );
  }

  /**
   * Get trial balance
   */
  static async getTrialBalance(asOfDate = new Date()) {
    return await GeneralLedger.getTrialBalance(asOfDate);
  }

  /**
   * Get balance sheet
   */
  static async getBalanceSheet(asOfDate = new Date()) {
    return await GeneralLedger.getBalanceSheet(asOfDate);
  }

  /**
   * Get profit & loss statement
   */
  static async getProfitAndLoss(startDate, endDate) {
    return await GeneralLedger.getProfitAndLoss(startDate, endDate);
  }

  /**
   * Get project ledger showing all revenues and expenses for a project
   */
  static async getProjectLedger(tenantId, projectId, startDate, endDate) {
    const query = {
      tenantId,
      project: projectId,
      status: "Active",
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const entries = await GeneralLedger.find(query)
      .sort({ date: 1 })
      .populate("account", "code name")
      .populate("journalEntry", "entryNumber description");

    // Categorize by revenue and expenses
    const revenues = entries.filter((e) => e.accountType === "Revenue");
    const expenses = entries.filter((e) => e.accountType === "Expense");
    const assets = entries.filter((e) => e.accountType === "Asset");

    const totalRevenue = revenues.reduce(
      (sum, e) => sum + e.credit - e.debit,
      0
    );
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + e.debit - e.credit,
      0
    );
    const netProfit = totalRevenue - totalExpenses;

    return {
      projectId,
      period: {
        startDate: startDate || "Beginning",
        endDate: endDate || "Present",
      },
      revenues: {
        entries: revenues,
        total: totalRevenue,
      },
      expenses: {
        entries: expenses,
        total: totalExpenses,
      },
      assets: {
        entries: assets,
      },
      profitability: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      },
    };
  }

  /**
   * Get customer ledger showing all transactions and payments
   */
  static async getCustomerLedger(tenantId, customerId, startDate, endDate) {
    const Customer = require("../models/Customer");
    const SalesInvoice = require("../models/SalesInvoice");

    const customer = await Customer.findOne({ _id: customerId, tenantId });
    if (!customer) {
      throw new Error("Customer not found");
    }

    const query = { tenantId, customer: customerId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const invoices = await SalesInvoice.find(query)
      .sort({ date: 1 })
      .populate("project", "name code");

    const totalSales = invoices.reduce((sum, inv) => sum + inv.netTotal, 0);
    const totalReceived = invoices.reduce(
      (sum, inv) => sum + inv.amountReceived,
      0
    );
    const balanceDue = totalSales - totalReceived;

    return {
      customer: {
        code: customer.code,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      period: {
        startDate: startDate || "Beginning",
        endDate: endDate || "Present",
      },
      transactions: invoices.map((inv) => ({
        date: inv.date,
        invoiceNo: inv.serialNo,
        project: inv.project?.name,
        amount: inv.netTotal,
        received: inv.amountReceived,
        balance: inv.balance,
        status: inv.status,
      })),
      summary: {
        totalSales,
        totalReceived,
        balanceDue,
        creditLimit: customer.creditLimit || 0,
        paymentStatus: balanceDue > 0 ? "Outstanding" : "Paid",
      },
    };
  }

  /**
   * Get supplier ledger showing all purchases and payments
   */
  static async getSupplierLedger(tenantId, supplierCode, startDate, endDate) {
    const Purchase = require("../models/Purchase");
    const Supplier = require("../models/Supplier");

    const supplier = await Supplier.findOne({ tenantId, code: supplierCode });
    if (!supplier) {
      throw new Error("Supplier not found");
    }

    const query = { tenantId, vendorCode: supplierCode };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const purchases = await Purchase.find(query)
      .sort({ date: 1 })
      .populate("item", "name itemCode")
      .populate("project", "name code");

    const totalPurchases = purchases.reduce((sum, p) => sum + p.netAmount, 0);
    const totalPaid = purchases.reduce(
      (sum, p) => sum + (p.amountPaid || 0),
      0
    );
    const balanceDue = totalPurchases - totalPaid;

    return {
      supplier: {
        code: supplier.code,
        name: supplier.name,
        company: supplier.company,
        category: supplier.category,
        phone: supplier.phone,
      },
      period: {
        startDate: startDate || "Beginning",
        endDate: endDate || "Present",
      },
      transactions: purchases.map((p) => ({
        date: p.date,
        poNumber: p.purchaseOrderNo,
        invoiceNo: p.vendorInvoiceNo,
        item: p.itemName,
        project: p.project?.name,
        amount: p.netAmount,
        paid: p.amountPaid || 0,
        balance: p.netAmount - (p.amountPaid || 0),
        paymentStatus: p.paymentStatus,
      })),
      summary: {
        totalPurchases,
        totalPaid,
        balanceDue,
        paymentTerms: supplier.paymentTerms || "N/A",
      },
    };
  }

  /**
   * Get inventory report showing stock levels and values
   */
  static async getInventoryReport(tenantId) {
    const Item = require("../models/Item");

    const items = await Item.find({ tenantId, isActive: true }).sort({
      categoryCode: 1,
      itemCode: 1,
    });

    const inventory = items.map((item) => ({
      itemCode: item.itemCode,
      name: item.name,
      category: item.categoryName,
      subCategory: item.subCategoryName,
      currentStock: item.currentStock,
      unit: item.measurement,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      stockValue: item.currentStock * item.purchasePrice,
      minStockLevel: item.minStockLevel,
      stockStatus:
        item.currentStock <= item.minStockLevel
          ? "Low Stock"
          : item.currentStock === 0
          ? "Out of Stock"
          : "In Stock",
    }));

    const totalStockValue = inventory.reduce(
      (sum, item) => sum + item.stockValue,
      0
    );
    const lowStockItems = inventory.filter(
      (item) => item.stockStatus === "Low Stock"
    );
    const outOfStockItems = inventory.filter(
      (item) => item.stockStatus === "Out of Stock"
    );

    return {
      asOfDate: new Date(),
      items: inventory,
      summary: {
        totalItems: inventory.length,
        totalStockValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
      },
      alerts: {
        lowStock: lowStockItems,
        outOfStock: outOfStockItems,
      },
    };
  }

  /**
   * Create journal entry for a plot booking
   * Proper double-entry format:
   * Debit: Cash Account (booking amount received)
   * Debit: Accounts Receivable - Customer (balance due)
   * Credit: Property Sales Revenue (total amount)
   */
  static async createPlotBookingJournalEntry(plot, userId) {
    const revenueAccount = await this.getOrCreateAccount(
      plot.tenantId,
      "4001",
      "Property Sales Revenue",
      "Revenue"
    );
    const receivableAccount = await this.getOrCreateAccount(
      plot.tenantId,
      "1200",
      "Accounts Receivable",
      "Asset"
    );
    const cashAccount = await this.getOrCreateAccount(
      plot.tenantId,
      "1000",
      "Cash Account",
      "Asset"
    );

    const lines = [];
    const totalAmount =
      plot.finalPrice || plot.grossAmount || plot.basePrice || 0;
    const amountReceived = plot.amountReceived || plot.bookingAmount || 0;
    const balanceDue = totalAmount - amountReceived;

    // Debit: Cash Account (amount received)
    if (amountReceived > 0) {
      lines.push({
        account: cashAccount._id,
        accountCode: cashAccount.code || "1000",
        accountName: cashAccount.name || "Cash Account",
        accountType: "Asset",
        debit: amountReceived,
        credit: 0,
        description: `Booking amount received for plot ${plot.plotNumber}`,
      });
    }

    // Debit: Accounts Receivable (balance due)
    if (balanceDue > 0) {
      lines.push({
        account: receivableAccount._id,
        accountCode: receivableAccount.code || "1200",
        accountName: receivableAccount.name || "Accounts Receivable",
        accountType: "Asset",
        debit: balanceDue,
        credit: 0,
        description: `Balance due from customer for plot ${plot.plotNumber}`,
      });
    }

    // Credit: Property Sales Revenue (total amount)
    lines.push({
      account: revenueAccount._id,
      accountCode: revenueAccount.code || "4001",
      accountName: revenueAccount.name || "Property Sales Revenue",
      accountType: "Revenue",
      debit: 0,
      credit: totalAmount,
      description: `Plot booking revenue for ${plot.plotNumber}`,
    });

    const entryData = {
      date: plot.bookingDate || new Date(),
      transactionType: "Booking",
      sourceTransaction: {
        model: "Plot",
        id: plot._id,
        reference: plot.plotNumber,
      },
      project: plot.project,
      description: `Plot Booking ${plot.plotNumber}${
        plot.customer ? ` - Customer linked` : ""
      }`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Create journal entry for a plot sale
   * This follows the standard format:
   * Debit: Cash Account (if additional payment received)
   * Credit: Accounts Receivable (if reducing balance)
   */
  static async createPlotSaleJournalEntry(plot, userId) {
    const receivableAccount = await this.getOrCreateAccount(
      plot.tenantId,
      "1200",
      "Accounts Receivable",
      "Asset"
    );
    const cashAccount = await this.getOrCreateAccount(
      plot.tenantId,
      "1000",
      "Cash Account",
      "Asset"
    );

    const lines = [];
    const amountReceived = plot.amountReceived || 0;

    // Only create entry if there's additional payment beyond booking
    if (amountReceived > 0) {
      // Debit: Cash Account
      lines.push({
        account: cashAccount._id,
        accountCode: cashAccount.code || "1000",
        accountName: cashAccount.name || "Cash Account",
        accountType: "Asset",
        debit: amountReceived,
        credit: 0,
        description: `Payment received for plot ${plot.plotNumber}`,
      });

      // Credit: Accounts Receivable
      lines.push({
        account: receivableAccount._id,
        accountCode: receivableAccount.code || "1200",
        accountName: receivableAccount.name || "Accounts Receivable",
        accountType: "Asset",
        debit: 0,
        credit: amountReceived,
        description: `Payment against plot ${plot.plotNumber}`,
      });

      const entryData = {
        date: plot.saleDate || new Date(),
        transactionType: "Sale",
        sourceTransaction: {
          model: "Plot",
          id: plot._id,
          reference: plot.plotNumber,
        },
        project: plot.project,
        description: `Plot Sale Payment ${plot.plotNumber}`,
        lines: lines,
      };

      return await this.createJournalEntry(entryData, userId);
    }

    return null;
  }

  /**
   * Create journal entry for a plot sales invoice
   * Similar format for consistency with plot sales
   */
  static async createPlotSalesInvoiceJournalEntry(salesInvoice, userId) {
    const revenueAccount = await this.getOrCreateAccount(
      salesInvoice.tenantId,
      "4001",
      "Property Sales Revenue",
      "Revenue"
    );
    const receivableAccount = await this.getOrCreateAccount(
      salesInvoice.tenantId,
      "1003",
      "Accounts Receivable",
      "Asset"
    );
    const cashAccount = await this.getOrCreateAccount(
      salesInvoice.tenantId,
      "1001",
      "Cash Account",
      "Asset"
    );

    const lines = [];

    // Debit: Accounts Receivable (full amount)
    lines.push({
      account: receivableAccount._id,
      accountCode: receivableAccount.code || "1003",
      accountName: receivableAccount.name || "Accounts Receivable",
      accountType: "Asset",
      debit: salesInvoice.netTotal,
      credit: 0,
      description: `Plot sales receivable from ${salesInvoice.customerName}`,
    });

    // Debit: Cash Account (if payment received)
    if (salesInvoice.amountReceived > 0) {
      lines.push({
        account: cashAccount._id,
        accountCode: cashAccount.code || "1001",
        accountName: cashAccount.name || "Cash Account",
        accountType: "Asset",
        debit: salesInvoice.amountReceived,
        credit: 0,
        description: `Cash received from ${salesInvoice.customerName}`,
      });
    }

    // Credit: Property Sales Revenue (total)
    const totalCredit =
      salesInvoice.netTotal + (salesInvoice.amountReceived || 0);
    lines.push({
      account: revenueAccount._id,
      accountCode: revenueAccount.code || "4001",
      accountName: revenueAccount.name || "Property Sales Revenue",
      accountType: "Revenue",
      debit: 0,
      credit: totalCredit,
      description: `Plot sales revenue from Invoice ${salesInvoice.serialNo}`,
    });

    const entryData = {
      date: salesInvoice.date,
      transactionType: "Sale",
      sourceTransaction: {
        model: "SalesInvoice",
        id: salesInvoice._id,
        reference: salesInvoice.serialNo,
      },
      project: salesInvoice.project,
      description: `Plot Sales Invoice ${salesInvoice.serialNo} - ${salesInvoice.customerName}`,
      lines: lines,
    };

    return await this.createJournalEntry(entryData, userId);
  }

  /**
   * Reverse a journal entry
   */
  static async reverseJournalEntry(entryId, userId, reason) {
    const entry = await JournalEntry.findById(entryId);
    if (!entry) {
      throw new Error("Journal entry not found");
    }

    const reversalEntry = await entry.reverse(userId, reason);

    // Post reversal to general ledger
    const session = await JournalEntry.startSession();
    session.startTransaction();

    try {
      await this.postToGeneralLedger(reversalEntry, session);

      // Mark original ledger entries as reversed
      await GeneralLedger.updateMany(
        { journalEntry: entryId },
        { status: "Reversed" },
        { session }
      );

      await session.commitTransaction();
      return reversalEntry;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = AccountingService;
