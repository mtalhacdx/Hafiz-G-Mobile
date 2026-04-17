const Category = require("../models/Category");
const { ApiError } = require("../utils/apiError");

const createCategory = async (req, res, next) => {
  try {
    const category = await Category.create(req.validatedBody);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) {
      return next(new ApiError(409, "Category name already exists"));
    }

    return next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const search = req.query.search?.trim();
    const query = search ? { categoryName: { $regex: search, $options: "i" } } : {};

    const categories = await Category.find(query).sort({ categoryName: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.validatedBody, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    res.json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) {
      return next(new ApiError(409, "Category name already exists"));
    }

    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    res.json({ success: true, message: "Category deactivated" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
