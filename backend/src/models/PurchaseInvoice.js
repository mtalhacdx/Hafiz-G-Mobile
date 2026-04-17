const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    purchaseInvoiceNumber: { type: String, required: true, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    date: { type: Date, required: true },
    items: { type: [purchaseItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "unpaid",
    },
    paidAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

purchaseInvoiceSchema.index({ date: -1 });
purchaseInvoiceSchema.index({ supplierId: 1, date: -1 });

module.exports = mongoose.model("PurchaseInvoice", purchaseInvoiceSchema);
