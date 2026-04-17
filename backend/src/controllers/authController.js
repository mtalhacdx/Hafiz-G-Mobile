const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const env = require("../config/env");
const Admin = require("../models/Admin");
const { ApiError } = require("../utils/apiError");

const bootstrapAdmin = async (req, res, next) => {
  try {
    const existing = await Admin.countDocuments();
    if (existing > 0) {
      throw new ApiError(409, "Admin already initialized");
    }

    const { email, password } = req.validatedBody;
    const passwordHash = await bcrypt.hash(password, 10);
    const username = String(email).split("@")[0].toLowerCase().trim();

    await Admin.create({
      email,
      username,
      name: "Owner Admin",
      passwordHash,
      role: "admin",
      isActive: true,
    });

    res.status(201).json({ success: true, message: "Admin created" });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.validatedBody;
    const admin = await Admin.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!admin) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (admin.isActive === false) {
      throw new ApiError(403, "Account is deactivated. Contact owner");
    }

    const passwordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordValid) {
      throw new ApiError(401, "Invalid credentials");
    }

    const token = jwt.sign(
      {
        adminId: admin._id.toString(),
        email: admin.email,
        username: admin.username,
        name: admin.name,
        role: admin.role || "admin",
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        name: admin.name || "User",
        username: admin.username || "",
        email: admin.email,
        role: admin.role || "admin",
        isActive: admin.isActive !== false,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const adminId = req.user?.adminId;
    const admin = await Admin.findById(adminId).select("name username email role isActive");

    if (!admin) {
      throw new ApiError(401, "Unauthorized");
    }

    if (admin.isActive === false) {
      throw new ApiError(403, "Account is deactivated. Contact owner");
    }

    res.json({
      success: true,
      data: {
        id: admin._id,
        name: admin.name || "",
        username: admin.username || "",
        email: admin.email || "",
        role: admin.role || "admin",
        isActive: admin.isActive !== false,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bootstrapAdmin,
  login,
  getSession,
};
