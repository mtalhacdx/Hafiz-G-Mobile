const { app } = require("../src/app");
const { connectDatabase } = require("../src/config/db");
const env = require("../src/config/env");

const setCorsHeaders = (req, res) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = env.corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (env.corsOrigin === "*" || (requestOrigin && allowedOrigins.includes(requestOrigin))) {
    res.setHeader("Access-Control-Allow-Origin", env.corsOrigin === "*" ? "*" : requestOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
};

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error("API startup failure:", error);
    return res.status(503).json({
      success: false,
      message: "Backend service is temporarily unavailable",
    });
  }
};
