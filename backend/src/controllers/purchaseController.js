const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const PurchaseInvoice = require("../models/PurchaseInvoice");
const DuePayment = require("../models/DuePayment");
const { ApiError } = require("../utils/apiError");
const { buildInvoiceNumber } = require("../utils/invoiceNumber");
const {
  runWithOptionalTransaction,
  applySession,
  saveWithOptionalSession,
  createWithOptionalSession,
} = require("../utils/transaction");

const createPurchase = async (req, res, next) => {
  try {
    const created = await runWithOptionalTransaction(async (session) => {
      const payload = req.validatedBody;
      const supplier = await applySession(
        Supplier.findOne({ _id: payload.supplierId, isActive: true }),
        session
      );

      if (!supplier) {
        throw new ApiError(404, "Supplier not found");
      }

      const items = [];
      let totalAmount = 0;

      for (const item of payload.items) {
        const product = await applySession(
          Product.findOne({ _id: item.productId, isActive: true }),
          session
        );

        if (!product) {
          throw new ApiError(404, "Product not found");
        }

        const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        totalAmount = Number((totalAmount + subtotal).toFixed(2));

        items.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        });

        product.stockQuantity += item.quantity;
        product.purchasePrice = item.unitPrice;
        await saveWithOptionalSession(product, session);
      }

      const paidAmount = payload.paidAmount || 0;
      if (paidAmount > totalAmount) {
        throw new ApiError(400, "Paid amount cannot exceed total amount");
      }

      const purchase = await createWithOptionalSession(
        PurchaseInvoice,
        [
          {
            purchaseInvoiceNumber: buildInvoiceNumber("PUR"),
            supplierId: payload.supplierId,
            date: payload.date,
            items,
            totalAmount,
            paymentStatus: payload.paymentStatus,
            paidAmount,
          },
        ],
        session
      );

      const payable = Number((totalAmount - paidAmount).toFixed(2));
      if (payable > 0) {
        supplier.balance = Number((supplier.balance + payable).toFixed(2));
        await saveWithOptionalSession(supplier, session);
      }

      return purchase[0];
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

const addPurchasePayment = async (req, res, next) => {
  try {
    const processorId = req.user?.adminId || req.user?.id || req.user?._id || null;
    const processorName =
      String(req.user?.name || req.user?.username || req.user?.email || "").trim() || "Unknown User";

    const updated = await runWithOptionalTransaction(async (session) => {
      const { amount, paymentMethod } = req.validatedBody;

      const invoice = await applySession(PurchaseInvoice.findById(req.params.id), session);

      if (!invoice) {
        throw new ApiError(404, "Purchase invoice not found");
      }

      const totalAmount = Number(invoice.totalAmount || 0);
      const paidAmount = Number(invoice.paidAmount || 0);
      const dueAmount = Number((totalAmount - paidAmount).toFixed(2));

      if (dueAmount <= 0) {
        throw new ApiError(400, "This purchase invoice is already fully paid");
      }

      if (amount > dueAmount) {
        throw new ApiError(400, "Payment amount cannot exceed remaining due");
      }

      invoice.paidAmount = Number((paidAmount + amount).toFixed(2));
      invoice.paymentStatus = invoice.paidAmount >= totalAmount ? "paid" : "partial";

      await saveWithOptionalSession(invoice, session);

      const supplier = await applySession(Supplier.findById(invoice.supplierId), session);

      if (supplier) {
        supplier.balance = Number(Math.max(0, supplier.balance - amount).toFixed(2));
        await saveWithOptionalSession(supplier, session);

        await createWithOptionalSession(
          DuePayment,
          [
            {
              mode: "payable",
              sourceInvoiceType: "purchase",
              sourceInvoiceId: invoice._id,
              invoiceNumber: invoice.purchaseInvoiceNumber,
              partyType: "supplier",
              partyId: supplier._id,
              partyName: supplier.name,
              processedById: processorId,
              processedByName: processorName,
              amount,
              paymentMethod,
              paidAt: new Date(),
            },
          ],
          session
        );
      }

      const hydrated = await applySession(
        PurchaseInvoice.findById(invoice._id)
          .populate("supplierId", "name phone")
          .populate("items.productId", "name"),
        session
      );

      return hydrated;
    });

    res.json({ success: true, data: updated, message: "Supplier payment recorded successfully" });
  } catch (error) {
    next(error);
  }
};

const getPurchases = async (req, res, next) => {
  try {
    const { supplierId, fromDate, toDate } = req.query;
    const query = {};

    if (supplierId) {
      query.supplierId = supplierId;
    }

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) {
        query.date.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.date.$lte = new Date(toDate);
      }
    }

    const purchases = await PurchaseInvoice.find(query)
      .populate("supplierId", "name phone")
      .populate("items.productId", "name")
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, data: purchases });
  } catch (error) {
    next(error);
  }
};

const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await PurchaseInvoice.findById(req.params.invoiceId)
      .populate("supplierId", "name phone")
      .populate("items.productId", "name");

    if (!purchase) {
      throw new ApiError(404, "Purchase invoice not found");
    }

    res.json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseById,
  addPurchasePayment,
};
