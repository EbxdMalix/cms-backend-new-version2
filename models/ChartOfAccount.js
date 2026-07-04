const mongoose = require("mongoose");

const SubAccountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    trim: true,
  },
});

const ListAccountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
});

const ChartOfAccountSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
    },
    code: {
      type: String,
      trim: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"],
    },
    mainAccountType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountType",
    },
    mainTypeCode: {
      type: String,
      trim: true,
    },
    mainAccountTypeText: {
      type: String,
      trim: true,
    },
    financialComponent: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChartOfAccount",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    subAccounts: [SubAccountSchema],
    listAccounts: [ListAccountSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

ChartOfAccountSchema.index({ tenantId: 1, mainAccountType: 1 });
ChartOfAccountSchema.index({ tenantId: 1, mainTypeCode: 1 });
ChartOfAccountSchema.index({ tenantId: 1, code: 1 });
ChartOfAccountSchema.index({ tenantId: 1, createdAt: -1 });
ChartOfAccountSchema.index({ tenantId: 1, updatedAt: -1 });

const ChartOfAccount = mongoose.model("ChartOfAccount", ChartOfAccountSchema);

module.exports = ChartOfAccount;
