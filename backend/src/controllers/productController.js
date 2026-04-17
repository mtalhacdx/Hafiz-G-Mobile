const Product = require("../models/Product");
const Brand = require("../models/Brand");
const { ApiError } = require("../utils/apiError");
const { buildSkuBase, ensureUniqueSku } = require("../utils/sku");

const createProduct = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ brandName: req.validatedBody.brandName, isActive: true });

    if (!brand) {
      throw new ApiError(400, "Selected brand is not active or does not exist");
    }

    const payload = { ...req.validatedBody };
    const baseSku = buildSkuBase({ name: payload.name, brandName: payload.brandName });
    payload.sku = await ensureUniqueSku({ Product, baseSku });

    const product = await Product.create(payload);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const { search, categoryId, brandName, lowStock } = req.query;
    const query = { isActive: true };

    if (search) {
      const keyword = search.trim();
      query.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { sku: { $regex: keyword, $options: "i" } },
        { brandName: { $regex: keyword, $options: "i" } },
      ];
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (brandName) {
      query.brandName = brandName;
    }

    const products = await Product.find(query)
      .populate("categoryId", "categoryName")
      .sort({ createdAt: -1 });

    const filtered =
      lowStock === "true"
        ? products.filter((item) => item.stockQuantity <= item.minStockLevel)
        : products;

    res.json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.validatedBody, "stockQuantity")) {
      throw new ApiError(400, "Manual stock editing is disabled");
    }

    if (Object.prototype.hasOwnProperty.call(req.validatedBody, "brandName")) {
      const brand = await Brand.findOne({ brandName: req.validatedBody.brandName, isActive: true });

      if (!brand) {
        throw new ApiError(400, "Selected brand is not active or does not exist");
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(req.validatedBody, "purchasePrice") ||
      Object.prototype.hasOwnProperty.call(req.validatedBody, "salePrice")
    ) {
      const existing = await Product.findById(req.params.id).select("purchasePrice salePrice");

      if (!existing) {
        throw new ApiError(404, "Product not found");
      }

      const nextPurchasePrice = Object.prototype.hasOwnProperty.call(req.validatedBody, "purchasePrice")
        ? Number(req.validatedBody.purchasePrice)
        : Number(existing.purchasePrice || 0);

      const nextSalePrice = Object.prototype.hasOwnProperty.call(req.validatedBody, "salePrice")
        ? Number(req.validatedBody.salePrice)
        : Number(existing.salePrice || 0);

      if (nextPurchasePrice >= nextSalePrice) {
        throw new ApiError(400, "Sale price must be greater than purchase price");
      }
    }

    const payload = { ...req.validatedBody };

    const current = await Product.findById(req.params.id).select("name brandName sku");

    if (!current) {
      throw new ApiError(404, "Product not found");
    }

    const nextName = payload.name || current.name;
    const nextBrandName = payload.brandName || current.brandName;

    if (!current.sku) {
      const baseSku = buildSkuBase({ name: nextName, brandName: nextBrandName });
      payload.sku = await ensureUniqueSku({ Product, baseSku, excludeId: current._id });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    res.json({ success: true, message: "Product deactivated" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
};
