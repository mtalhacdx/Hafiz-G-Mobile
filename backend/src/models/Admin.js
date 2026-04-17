const mongoose = require("mongoose");

const adminRoles = ["admin", "small_manager"];

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: "Owner Admin" },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: adminRoles, default: "admin" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
