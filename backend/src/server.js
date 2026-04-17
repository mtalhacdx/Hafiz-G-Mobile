const { app } = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/db");

const start = async () => {
  await connectDatabase();

  app.listen(env.port, () => {
    // Keep startup logs explicit for easier local-network deployment checks.
    console.log(`Server listening on port ${env.port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
