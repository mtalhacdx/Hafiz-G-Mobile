const dotenv = require("dotenv");

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const jwtSecret = process.env.JWT_SECRET || "change-me";
const nodeEnv = process.env.NODE_ENV || "development";

if (nodeEnv === "production" && jwtSecret === "change-me") {
  throw new Error("JWT_SECRET must be set in production");
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv,
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hafizgmobile",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  authRateWindowMs: toNumber(process.env.AUTH_RATE_WINDOW_MS, 10 * 60 * 1000),
  authRateMax: toNumber(process.env.AUTH_RATE_MAX, 15),
};
