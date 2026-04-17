const { ApiError } = require("../utils/apiError");
const env = require("../config/env");

const buckets = new Map();

const pruneOld = (timestamps, windowMs, now) => timestamps.filter((stamp) => now - stamp < windowMs);

const createRateLimiter = ({ windowMs, maxRequests, keyPrefix }) => {
  return (req, _res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || "unknown"}`;
    const history = pruneOld(buckets.get(key) || [], windowMs, now);

    if (history.length >= maxRequests) {
      return next(new ApiError(429, "Too many attempts. Please try again later."));
    }

    history.push(now);
    buckets.set(key, history);
    return next();
  };
};

const authRateLimiter = createRateLimiter({
  windowMs: env.authRateWindowMs,
  maxRequests: env.authRateMax,
  keyPrefix: "auth",
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
};
