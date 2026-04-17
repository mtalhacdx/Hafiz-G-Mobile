const mongoose = require("mongoose");
const env = require("./env");

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(env.mongodbUri);
  // Keep queries strict to avoid accidental writes to undefined fields.
  mongoose.set("strictQuery", true);
};

module.exports = { connectDatabase };
