const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    claimNumber: { type: String, required: true, unique: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: true },
    purchaseInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseInvoice",
      default: null,
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    receivedByName: { type: String, default: "Unknown User" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
    replacementGiven: { type: Boolean, default: false },
    refundGiven: { type: Boolean, default: false },
    refundAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["pending", "sent_to_supplier", "accepted", "rejected", "closed"],
      default: "pending",
    },
    supplierStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    purchasePrice: { type: Number, required: true, min: 0 },
    lossAmount: { type: Number, min: 0, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

claimSchema.index({ status: 1, createdAt: -1 });
claimSchema.index({ supplierStatus: 1, createdAt: -1 });
claimSchema.index({ supplierId: 1, createdAt: -1 });
claimSchema.index({ customerId: 1, createdAt: -1 });
claimSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model("Claim", claimSchema);
