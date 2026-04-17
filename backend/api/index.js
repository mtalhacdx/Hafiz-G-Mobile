const { app } = require("../src/app");
const { connectDatabase } = require("../src/config/db");

module.exports = async (req, res) => {
  await connectDatabase();
  return app(req, res);
};
