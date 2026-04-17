const jwt = require("jsonwebtoken");
const env = require("../config/env");
const Admin = require("../models/Admin");
const { ApiError } = require("../utils/apiError");

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Unauthorized"));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const adminId = decoded?.adminId || decoded?.id || decoded?._id;
    const username = decoded?.username ? String(decoded.username).toLowerCase().trim() : "";
    const email = decoded?.email ? String(decoded.email).toLowerCase().trim() : "";

    let account = null;

    if (adminId) {
      account = await Admin.findById(adminId).select("_id name username email role isActive");
    }

    if (!account && (username || email)) {
      const filters = [];
      if (username) {
        filters.push({ username });
      }
      if (email) {
        filters.push({ email });
      }

      if (filters.length > 0) {
        account = await Admin.findOne({ $or: filters }).select("_id name username email role isActive");
      }
    }

    if (!account) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const resolvedRole = account.role || decoded?.role || "admin";
    const resolvedActive = account.isActive !== false;

    if (!resolvedActive) {
      return next(new ApiError(403, "Account is deactivated. Contact owner"));
    }

    req.user = {
      ...decoded,
      adminId: account._id.toString(),
      id: account._id.toString(),
      name: account.name || decoded?.name || "",
      username: account.username || decoded?.username || "",
      email: account.email || decoded?.email || "",
      role: resolvedRole,
      isActive: resolvedActive,
    };
    return next();
  } catch (error) {
    return next(new ApiError(401, "Invalid token"));
  }
};

const requireAnyRole = (...roles) => (req, res, next) => {
  const role = req.user?.role;

  if (!role || !roles.includes(role)) {
    return next(new ApiError(403, "Forbidden: insufficient permissions"));
  }

  return next();
};

const requireRole = (role) => requireAnyRole(role);

module.exports = { requireAuth, requireRole, requireAnyRole };
