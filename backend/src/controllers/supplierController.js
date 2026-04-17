const Supplier = require("../models/Supplier");
const { ApiError } = require("../utils/apiError");

const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.validatedBody);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

const getSuppliers = async (req, res, next) => {
  try {
    const search = req.query.search?.trim();
    const includeInactive = req.query.includeInactive === "true";
    const query = includeInactive ? {} : { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const suppliers = await Supplier.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.validatedBody, "balance")) {
      throw new ApiError(400, "Supplier balance is system-managed");
    }

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.validatedBody, {
      new: true,
      runValidators: true,
    });

    if (!supplier) {
      throw new ApiError(404, "Supplier not found");
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      throw new ApiError(404, "Supplier not found");
    }

    res.json({ success: true, message: "Supplier deactivated" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
};
