const Brand = require("../models/Brand");
const { ApiError } = require("../utils/apiError");

const createBrand = async (req, res, next) => {
  try {
    const brand = await Brand.create(req.validatedBody);
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    if (error.code === 11000) {
      return next(new ApiError(409, "Brand name already exists"));
    }

    return next(error);
  }
};

const getBrands = async (req, res, next) => {
  try {
    const search = req.query.search?.trim();
    const includeInactive = req.query.includeInactive === "true";
    const query = {};

    if (!includeInactive) {
      query.isActive = true;
    }

    if (search) {
      query.brandName = { $regex: search, $options: "i" };
    }

    const brands = await Brand.find(query).sort({ brandName: 1 });
    res.json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

const updateBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.validatedBody, {
      new: true,
      runValidators: true,
    });

    if (!brand) {
      throw new ApiError(404, "Brand not found");
    }

    res.json({ success: true, data: brand });
  } catch (error) {
    if (error.code === 11000) {
      return next(new ApiError(409, "Brand name already exists"));
    }

    return next(error);
  }
};

const deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

    if (!brand) {
      throw new ApiError(404, "Brand not found");
    }

    res.json({ success: true, message: "Brand deactivated" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBrand,
  getBrands,
  updateBrand,
  deleteBrand,
};
