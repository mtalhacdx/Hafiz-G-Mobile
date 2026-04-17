const mongoose = require("mongoose");

const duePaymentSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["receivable", "payable"],
      required: true,
    },
    sourceInvoiceType: {
      type: String,
      enum: ["sale", "purchase"],
      required: true,
    },
    sourceInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    invoiceNumber: { type: String, required: true },
    partyType: {
      type: String,
      enum: ["customer", "supplier"],
      required: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    partyName: { type: String, required: true },
    processedById: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    processedByName: { type: String, default: "Unknown User" },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "card", "upi", "other"],
      required: true,
    },
    paidAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

duePaymentSchema.index({ paidAt: -1 });
duePaymentSchema.index({ sourceInvoiceType: 1, sourceInvoiceId: 1 });
duePaymentSchema.index({ partyType: 1, partyId: 1, paidAt: -1 });
duePaymentSchema.index({ processedById: 1, paidAt: -1 });

module.exports = mongoose.model("DuePayment", duePaymentSchema);
