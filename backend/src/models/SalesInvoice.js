const mongoose = require("mongoose");

const salesItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const salesInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    generatedById: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    generatedByName: { type: String, default: "Unknown User" },
    date: { type: Date, required: true },
    items: { type: [salesItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "card", "upi", "other"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "paid",
    },
    paidAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

salesInvoiceSchema.index({ date: -1 });
salesInvoiceSchema.index({ customerId: 1, date: -1 });

module.exports = mongoose.model("SalesInvoice", salesInvoiceSchema);
