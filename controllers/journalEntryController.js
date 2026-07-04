const JournalEntry = require("../models/JournalEntry");
const AccountingService = require("../services/accountingService");

// @desc    Get all journal entries
// @route   GET /api/journal-entries
// @access  Private
const getJournalEntries = async (req, res) => {
  try {
    const { startDate, endDate, transactionType, status, project } = req.query;

    // Build query
    const query = { tenantId: req.tenantId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (transactionType) query.transactionType = transactionType;
    if (status) query.status = status;
    if (project) query.project = project;

    const entries = await JournalEntry.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .populate("project", "name code")
      .populate("lines.account", "code name");

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching journal entries",
      error: error.message,
    });
  }
};

// @desc    Get single journal entry
// @route   GET /api/journal-entries/:id
// @access  Private
const getJournalEntryById = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .populate("project", "name code")
      .populate("lines.account", "code name")
      .populate("reversedBy")
      .populate("reversalOf");

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error("Error fetching journal entry:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching journal entry",
      error: error.message,
    });
  }
};

// @desc    Create new journal entry
// @route   POST /api/journal-entries
// @access  Private
const createJournalEntry = async (req, res) => {
  try {
    const entryData = req.body;

    // Create journal entry using accounting service
    const entry = await AccountingService.createJournalEntry(
      entryData,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: "Journal entry created successfully",
      data: entry,
    });
  } catch (error) {
    console.error("Error creating journal entry:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error creating journal entry",
      error: error.message,
    });
  }
};

// @desc    Update journal entry (only if in Draft status)
// @route   PUT /api/journal-entries/:id
// @access  Private
const updateJournalEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (entry.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft journal entries can be updated",
      });
    }

    // Update allowed fields
    const { date, description, lines, notes, project } = req.body;

    if (date) entry.date = date;
    if (description) entry.description = description;
    if (lines) entry.lines = lines;
    if (notes) entry.notes = notes;
    if (project) entry.project = project;

    await entry.save();

    res.status(200).json({
      success: true,
      message: "Journal entry updated successfully",
      data: entry,
    });
  } catch (error) {
    console.error("Error updating journal entry:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error updating journal entry",
      error: error.message,
    });
  }
};

// @desc    Delete journal entry (only if in Draft status)
// @route   DELETE /api/journal-entries/:id
// @access  Private
const deleteJournalEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (entry.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message:
          "Only draft journal entries can be deleted. Use reverse instead.",
      });
    }

    await entry.deleteOne();

    res.status(200).json({
      success: true,
      message: "Journal entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting journal entry:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting journal entry",
      error: error.message,
    });
  }
};

// @desc    Reverse a posted journal entry
// @route   POST /api/journal-entries/:id/reverse
// @access  Private
const reverseJournalEntry = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason for reversal is required",
      });
    }

    const reversalEntry = await AccountingService.reverseJournalEntry(
      req.params.id,
      req.user._id,
      reason
    );

    res.status(200).json({
      success: true,
      message: "Journal entry reversed successfully",
      data: reversalEntry,
    });
  } catch (error) {
    console.error("Error reversing journal entry:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error reversing journal entry",
      error: error.message,
    });
  }
};

// @desc    Get journal entries by account
// @route   GET /api/journal-entries/account/:accountCode
// @access  Private
const getJournalEntriesByAccount = async (req, res) => {
  try {
    const { accountCode } = req.params;
    const { startDate, endDate } = req.query;

    const entries = await JournalEntry.getByAccount(
      accountCode,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    console.error("Error fetching journal entries by account:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching journal entries",
      error: error.message,
    });
  }
};

// @desc    Post a draft journal entry
// @route   POST /api/journal-entries/:id/post
// @access  Private
const postJournalEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (entry.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft journal entries can be posted",
      });
    }

    // Update status and post to general ledger
    entry.status = "Posted";
    entry.isPosted = true;
    entry.postedAt = new Date();
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();

    await entry.save();

    // Post to general ledger
    await AccountingService.postToGeneralLedger(entry);

    res.status(200).json({
      success: true,
      message: "Journal entry posted successfully",
      data: entry,
    });
  } catch (error) {
    console.error("Error posting journal entry:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error posting journal entry",
      error: error.message,
    });
  }
};

module.exports = {
  getJournalEntries,
  getJournalEntryById,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  reverseJournalEntry,
  getJournalEntriesByAccount,
  postJournalEntry,
};
