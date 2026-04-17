const mongoose = require("mongoose");

const isTransactionUnsupported = (error) =>
  error?.message?.includes("Transaction numbers are only allowed on a replica set member or mongos");

const runWithOptionalTransaction = async (operation) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await operation(session);
    });

    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      return operation(null);
    }

    throw error;
  } finally {
    session.endSession();
  }
};

const applySession = (query, session) => {
  if (session) {
    return query.session(session);
  }

  return query;
};

const saveWithOptionalSession = (doc, session) => {
  if (session) {
    return doc.save({ session });
  }

  return doc.save();
};

const createWithOptionalSession = (model, docs, session) => {
  if (session) {
    return model.create(docs, { session });
  }

  return model.create(docs);
};

module.exports = {
  runWithOptionalTransaction,
  applySession,
  saveWithOptionalSession,
  createWithOptionalSession,
};
