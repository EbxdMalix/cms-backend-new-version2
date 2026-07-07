const BankPayment = require("../models/BankPayment");
const ChartOfAccount = require("../models/ChartOfAccount");
const { notifyAdmins } = require("./notificationController");

// @desc    Get all bank payments
// @route   GET /api/bankpayments
// @access  Private
const getBankPayments = async (req, res) => {
  try {
    const payments = await BankPayment.find({ tenantId: req.tenantId })
      .populate("project", "name description")
      .populate("employeeRef", "name email")
      .populate("createdBy", "name email")
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("Error fetching bank payments:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get single bank payment by ID
// @route   GET /api/bankpayments/:id
// @access  Private
const getBankPaymentById = async (req, res) => {
  try {
    const payment = await BankPayment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate("project", "name description")
      .populate("employeeRef", "name email")
      .populate("createdBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Bank Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error fetching bank payment:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Create new bank payment
// @route   POST /api/bankpayments
// @access  Private
const createBankPayment = async (req, res) => {
  try {
    const {
      serialNo,
      cancel,
      date,
      project,
      jobDescription,
      employeeRef,
      bankAccount,
      bankAccountNumber,
      chequeNo,
      chequeDate,
      paymentLines,
    } = req.body;

    // Validate required fields
    if (!date || !bankAccount || !paymentLines || paymentLines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Validate payment lines
    for (const line of paymentLines) {
      if (!line.accountCode || !line.accountName || !line.amount) {
        return res.status(400).json({
          success: false,
          message: "Each payment line must have account code, name, and amount",
        });
      }
    }

    // Calculate total amount
    const totalAmount = paymentLines.reduce(
      (sum, line) => sum + Number(line.amount),
      0
    );

    const { runInTransaction } = require("../services/transactionService");

    let payment;
    await runInTransaction(async (session) => {
      const createdPayments = await BankPayment.create([
        {
          tenantId: req.tenantId,
          serialNo: serialNo || undefined, // Will be auto-generated if not provided
          cancel: cancel || false,
          date,
          project: project || undefined,
          jobDescription,
          employeeRef: employeeRef || undefined,
          bankAccount,
          bankAccountNumber,
          chequeNo,
          chequeDate: chequeDate || undefined,
          paymentLines,
          totalAmount,
          createdBy: req.user._id,
        }
      ], { session });
      payment = createdPayments[0];
    });

    // Populate references
    await payment.populate([
      { path: "project", select: "name description" },
      { path: "employeeRef", select: "name email" },
      { path: "createdBy", select: "name email" },
    ]);

    notifyAdmins({
      tenantId: req.tenantId,
      sender: req.user._id,
      type: "bank_payment_created",
      title: "New Bank Payment",
      message: `Bank payment ${payment.serialNo} created by ${req.user.name}`,
      entityType: "bank_payment",
      entityId: payment._id,
      metadata: { serialNo: payment.serialNo, totalAmount: payment.totalAmount },
      priority: "high",
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({
      success: true,
      message: "Bank Payment created successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error creating bank payment:", error);

    // Handle duplicate serial number
    if (error.code === 11000 && error.keyPattern?.serialNo) {
      return res.status(400).json({
        success: false,
        message: "Serial number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Update bank payment
// @route   PUT /api/bankpayments/:id
// @access  Private
const updateBankPayment = async (req, res) => {
  try {
    const {
      cancel,
      date,
      project,
      jobDescription,
      employeeRef,
      bankAccount,
      bankAccountNumber,
      chequeNo,
      chequeDate,
      paymentLines,
    } = req.body;

    let payment = await BankPayment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Bank Payment not found",
      });
    }

    // Update fields
    if (cancel !== undefined) payment.cancel = cancel;
    if (date) payment.date = date;
    if (project !== undefined) payment.project = project;
    if (jobDescription !== undefined) payment.jobDescription = jobDescription;
    if (employeeRef !== undefined) payment.employeeRef = employeeRef;
    if (bankAccount) payment.bankAccount = bankAccount;
    if (bankAccountNumber !== undefined)
      payment.bankAccountNumber = bankAccountNumber;
    if (chequeNo !== undefined) payment.chequeNo = chequeNo;
    if (chequeDate !== undefined) payment.chequeDate = chequeDate;

    if (paymentLines && paymentLines.length > 0) {
      payment.paymentLines = paymentLines;
      payment.totalAmount = paymentLines.reduce(
        (sum, line) => sum + Number(line.amount),
        0
      );
    }

    await payment.save();

    // Populate references
    await payment.populate([
      { path: "project", select: "name description" },
      { path: "employeeRef", select: "name email" },
      { path: "createdBy", select: "name email" },
    ]);

    res.status(200).json({
      success: true,
      message: "Bank Payment updated successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error updating bank payment:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Delete bank payment
// @route   DELETE /api/bankpayments/:id
// @access  Private
const deleteBankPayment = async (req, res) => {
  try {
    const payment = await BankPayment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Bank Payment not found",
      });
    }

    await payment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Bank Payment deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("Error deleting bank payment:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get bank enum values
// @route   GET /api/bankpayments/enums/banks
// @access  Private
const getBankEnum = async (req, res) => {
  try {
    const banks = [
      { value: "Meezan Bank", label: "Meezan Bank", code: "MEZ" },
      { value: "HBL", label: "Habib Bank Limited (HBL)", code: "HBL" },
      { value: "Allied Bank", label: "Allied Bank", code: "ABL" },
      { value: "UBL", label: "United Bank Limited (UBL)", code: "UBL" },
      { value: "MCB", label: "Muslim Commercial Bank (MCB)", code: "MCB" },
      {
        value: "Standard Chartered",
        label: "Standard Chartered Bank",
        code: "SCB",
      },
      { value: "Faysal Bank", label: "Faysal Bank", code: "FBL" },
      { value: "Bank Alfalah", label: "Bank Alfalah", code: "BAFL" },
      { value: "Al Makramah Bank", label: "Al Makramah Bank", code: "AMB" },
    ];

    res.status(200).json({
      success: true,
      data: banks,
    });
  } catch (error) {
    console.error("Error fetching bank enum:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Get expense accounts from Chart of Accounts
// @route   GET /api/bankpayments/expense-accounts
// @access  Private
const getExpenseAccounts = async (req, res) => {
  try {
    const accounts = await ChartOfAccount.find({ tenantId: req.tenantId });

    // Flatten all sub accounts with their parent info
    const expenseAccounts = [];

    accounts.forEach((account) => {
      if (account.subAccounts && account.subAccounts.length > 0) {
        account.subAccounts.forEach((subAccount) => {
          expenseAccounts.push({
            accountCode: subAccount.code,
            accountName: subAccount.type,
            mainAccountType: account.mainAccountType,
            mainTypeCode: account.mainTypeCode,
            financialComponent: account.financialComponent,
          });
        });
      }

      // Also include list accounts if they exist
      if (account.listAccounts && account.listAccounts.length > 0) {
        account.listAccounts.forEach((listAccount) => {
          expenseAccounts.push({
            accountCode: listAccount.code,
            accountName: listAccount.name,
            mainAccountType: account.mainAccountType,
            mainTypeCode: account.mainTypeCode,
            financialComponent: account.financialComponent,
          });
        });
      }
    });

    res.status(200).json({
      success: true,
      count: expenseAccounts.length,
      data: expenseAccounts,
    });
  } catch (error) {
    console.error("Error fetching expense accounts:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// @desc    Generate next serial number
// @route   GET /api/bankpayments/generate-serial
// @access  Private
const generateSerialNumber = async (req, res) => {
  try {
    const count = await BankPayment.countDocuments({ tenantId: req.tenantId });
    const serialNo = `BP${String(count + 1).padStart(6, "0")}`;

    res.status(200).json({
      success: true,
      data: { serialNo },
    });
  } catch (error) {
    console.error("Error generating serial number:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getBankPayments,
  getBankPaymentById,
  createBankPayment,
  updateBankPayment,
  deleteBankPayment,
  getBankEnum,
  getExpenseAccounts,
  generateSerialNumber,
};
