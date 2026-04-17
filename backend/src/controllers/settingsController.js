const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const SalesInvoice = require("../models/SalesInvoice");
const PurchaseInvoice = require("../models/PurchaseInvoice");
const ProductReturn = require("../models/ProductReturn");
const Claim = require("../models/Claim");
const DuePayment = require("../models/DuePayment");
const { ApiError } = require("../utils/apiError");

const REQUIRED_OPERATIONAL_CONFIRMATION = "RESET OPERATIONAL DATA";
const REQUIRED_MASTER_CONFIRMATION = "RESET ALL DATA";

const toPublicUser = (admin) => ({
  id: admin._id,
  name: admin.name || "",
  username: admin.username || "",
  email: admin.email,
  role: admin.role || "admin",
  isActive: admin.isActive !== false,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
});

const changePassword = async (req, res, next) => {
  try {
    const adminId = req.user?.adminId;

    if (!adminId) {
      throw new ApiError(401, "Unauthorized");
    }

    const { currentPassword, newPassword } = req.validatedBody;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      throw new ApiError(404, "Admin account not found");
    }

    const passwordValid = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!passwordValid) {
      throw new ApiError(400, "Current password is incorrect");
    }

    const samePassword = await bcrypt.compare(newPassword, admin.passwordHash);

    if (samePassword) {
      throw new ApiError(400, "New password must be different from current password");
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

const applyLowStockThreshold = async (req, res, next) => {
  try {
    const threshold = Number(req.body?.threshold);

    if (!Number.isFinite(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
      throw new ApiError(400, "Threshold must be a non-negative integer");
    }

    const result = await Product.updateMany({}, { $set: { minStockLevel: threshold } });

    res.json({
      success: true,
      message: "Low stock threshold applied to all products",
      data: {
        threshold,
        affectedProducts: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resetSystemData = async (req, res, next) => {
  try {
    const confirmation = String(req.body?.confirmation || "").trim().toUpperCase();

    if (confirmation !== REQUIRED_OPERATIONAL_CONFIRMATION) {
      throw new ApiError(400, `Confirmation text must be '${REQUIRED_OPERATIONAL_CONFIRMATION}'`);
    }

    const [
      salesResult,
      purchasesResult,
      returnsResult,
      claimsResult,
      duePaymentsResult,
      productResetResult,
      customerResetResult,
      supplierResetResult,
    ] = await Promise.all([
      SalesInvoice.deleteMany({}),
      PurchaseInvoice.deleteMany({}),
      ProductReturn.deleteMany({}),
      Claim.deleteMany({}),
      DuePayment.deleteMany({}),
      Product.updateMany({}, { $set: { claimStockQuantity: 0 } }),
      Customer.updateMany({}, { $set: { balance: 0 } }),
      Supplier.updateMany({}, { $set: { balance: 0 } }),
    ]);

    res.json({
      success: true,
      message: "Operational history has been reset successfully",
      data: {
        salesInvoices: salesResult.deletedCount || 0,
        purchaseInvoices: purchasesResult.deletedCount || 0,
        returns: returnsResult.deletedCount || 0,
        claims: claimsResult.deletedCount || 0,
        duePayments: duePaymentsResult.deletedCount || 0,
        productsClaimStockReset: productResetResult.modifiedCount || 0,
        customersBalanceReset: customerResetResult.modifiedCount || 0,
        suppliersBalanceReset: supplierResetResult.modifiedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resetMasterData = async (req, res, next) => {
  try {
    const confirmation = String(req.body?.confirmation || "").trim().toUpperCase();

    if (confirmation !== REQUIRED_MASTER_CONFIRMATION) {
      throw new ApiError(400, `Confirmation text must be '${REQUIRED_MASTER_CONFIRMATION}'`);
    }

    const [
      categoriesResult,
      brandsResult,
      productsResult,
      customersResult,
      suppliersResult,
      salesResult,
      purchasesResult,
      returnsResult,
      claimsResult,
      duePaymentsResult,
    ] = await Promise.all([
      Category.deleteMany({}),
      Brand.deleteMany({}),
      Product.deleteMany({}),
      Customer.deleteMany({}),
      Supplier.deleteMany({}),
      SalesInvoice.deleteMany({}),
      PurchaseInvoice.deleteMany({}),
      ProductReturn.deleteMany({}),
      Claim.deleteMany({}),
      DuePayment.deleteMany({}),
    ]);

    res.json({
      success: true,
      message: "All software data has been removed successfully",
      data: {
        categories: categoriesResult.deletedCount || 0,
        brands: brandsResult.deletedCount || 0,
        products: productsResult.deletedCount || 0,
        customers: customersResult.deletedCount || 0,
        suppliers: suppliersResult.deletedCount || 0,
        salesInvoices: salesResult.deletedCount || 0,
        purchaseInvoices: purchasesResult.deletedCount || 0,
        returns: returnsResult.deletedCount || 0,
        claims: claimsResult.deletedCount || 0,
        duePayments: duePaymentsResult.deletedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const listManagerUsers = async (_req, res, next) => {
  try {
    const users = await Admin.find(
      {},
      { name: 1, username: 1, email: 1, role: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    ).sort({
      createdAt: 1,
    });

    res.json({
      success: true,
      data: users.map(toPublicUser),
    });
  } catch (error) {
    next(error);
  }
};

const createManagerUser = async (req, res, next) => {
  try {
    const { name, username, password } = req.validatedBody;
    const existing = await Admin.findOne({ username });

    if (existing) {
      throw new ApiError(409, "User with this username already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await Admin.create({
      name,
      username,
      email: null,
      passwordHash,
      role: "small_manager",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Small manager account created",
      data: toPublicUser(created),
    });
  } catch (error) {
    next(error);
  }
};

const resetManagerPassword = async (req, res, next) => {
  try {
    const managerId = req.params.id;
    const requesterId = req.user?.adminId;

    const account = await Admin.findById(managerId);
    if (!account) {
      throw new ApiError(404, "User account not found");
    }

    if ((account.role || "admin") !== "small_manager") {
      throw new ApiError(400, "Only small manager accounts can be reset here");
    }

    if (String(account._id) === String(requesterId)) {
      throw new ApiError(400, "Use change password for your own account");
    }

    account.passwordHash = await bcrypt.hash(req.validatedBody.newPassword, 10);
    await account.save();

    res.json({
      success: true,
      message: "Manager password reset successfully",
      data: toPublicUser(account),
    });
  } catch (error) {
    next(error);
  }
};

const updateManagerStatus = async (req, res, next) => {
  try {
    const managerId = req.params.id;
    const requesterId = req.user?.adminId;

    const account = await Admin.findById(managerId);
    if (!account) {
      throw new ApiError(404, "User account not found");
    }

    if ((account.role || "admin") !== "small_manager") {
      throw new ApiError(400, "Only small manager accounts can be updated here");
    }

    if (String(account._id) === String(requesterId)) {
      throw new ApiError(400, "You cannot change your own active status");
    }

    account.isActive = req.validatedBody.isActive;
    await account.save();

    res.json({
      success: true,
      message: req.validatedBody.isActive ? "Manager account activated" : "Manager account deactivated",
      data: toPublicUser(account),
    });
  } catch (error) {
    next(error);
  }
};

const deleteManagerUser = async (req, res, next) => {
  try {
    const managerId = req.params.id;
    const account = await Admin.findById(managerId);

    if (!account) {
      throw new ApiError(404, "User account not found");
    }

    if ((account.role || "admin") !== "small_manager") {
      throw new ApiError(400, "Only stock manager accounts can be deleted");
    }

    await Admin.deleteOne({ _id: managerId });

    res.json({
      success: true,
      message: "Stock manager deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  changePassword,
  applyLowStockThreshold,
  resetSystemData,
  resetMasterData,
  listManagerUsers,
  createManagerUser,
  resetManagerPassword,
  updateManagerStatus,
  deleteManagerUser,
};
