const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "" },
  },
  { _id: false }
);

const productReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    saleInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    receivedByName: { type: String, default: "Unknown User" },
    date: { type: Date, required: true },
    items: { type: [returnItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ["cash", "bank", "card", "upi", "other", "adjustment"],
      default: "adjustment",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

productReturnSchema.index({ date: -1 });
productReturnSchema.index({ saleInvoiceId: 1, date: -1 });
productReturnSchema.index({ customerId: 1, date: -1 });

module.exports = mongoose.model("ProductReturn", productReturnSchema);
