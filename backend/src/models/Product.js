const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, unique: true, sparse: true, default: null },
    brandName: { type: String, required: true, trim: true, default: "Generic" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    claimStockQuantity: { type: Number, required: true, min: 0, default: 0 },
    minStockLevel: { type: Number, required: true, min: 0, default: 10 },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ brandName: 1 });
productSchema.index({ categoryId: 1 });

module.exports = mongoose.model("Product", productSchema);
