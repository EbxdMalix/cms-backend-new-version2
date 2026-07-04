const mongoose = require("mongoose");

/**
 * Executes a callback within a MongoDB replica set transaction session.
 * Automatically commits on success and aborts/rolls back on failure.
 * @param {Function} asyncFn - Async function to run within the transaction context (receives `session` as arg)
 * @returns {Promise<any>} The result of the async function
 */
const runInTransaction = async (asyncFn) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await asyncFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = { runInTransaction };
