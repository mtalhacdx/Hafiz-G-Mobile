const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Customer = require("../models/Customer");
const Admin = require("../models/Admin");
const SalesInvoice = require("../models/SalesInvoice");
const DuePayment = require("../models/DuePayment");
const { ApiError } = require("../utils/apiError");
const { buildInvoiceNumber } = require("../utils/invoiceNumber");
const {
  runWithOptionalTransaction,
  applySession,
  saveWithOptionalSession,
  createWithOptionalSession,
} = require("../utils/transaction");

const createSale = async (req, res, next) => {
  try {
    const created = await runWithOptionalTransaction(async (session) => {
      const creatorIdCandidate = req.user?.adminId || req.user?.id || req.user?._id || null;
      let creatorName = (req.user?.name || req.user?.username || req.user?.email || "").trim();
      let creatorId = creatorIdCandidate;
      let creatorAccount = null;

      if (creatorIdCandidate) {
        creatorAccount = await applySession(
          Admin.findById(creatorIdCandidate).select("_id name username"),
          session
        );
      }

      if (!creatorAccount && (req.user?.username || req.user?.email)) {
        const identifierFilters = [];
        if (req.user?.username) {
          identifierFilters.push({ username: String(req.user.username).toLowerCase().trim() });
        }
        if (req.user?.email) {
          identifierFilters.push({ email: String(req.user.email).toLowerCase().trim() });
        }

        if (identifierFilters.length > 0) {
          creatorAccount = await applySession(
            Admin.findOne({ $or: identifierFilters }).select("_id name username"),
            session
          );
        }
      }

      if (creatorAccount) {
        creatorId = creatorAccount._id;
        creatorName = String(creatorAccount.name || creatorAccount.username || creatorName || "").trim();
      }

      const payload = req.validatedBody;
      let customer = null;

      if (payload.customerId) {
        customer = await applySession(
          Customer.findOne({ _id: payload.customerId, isActive: true }),
          session
        );
        if (!customer) {
          throw new ApiError(404, "Customer not found");
        }
      }

      const items = [];
      let subtotal = 0;
      const preparedLines = [];
      const productById = new Map();
      const requestedByProductId = new Map();

      for (const item of payload.items) {
        const product = await applySession(
          Product.findOne({ _id: item.productId, isActive: true }),
          session
        );

        if (!product) {
          throw new ApiError(404, "Product not found");
        }

        const category = await applySession(
          Category.findOne({ _id: product.categoryId, isActive: true }),
          session
        );

        if (!category) {
          throw new ApiError(400, `${product.name} cannot be sold because its category is inactive`);
        }

        const brand = await applySession(
          Brand.findOne({ brandName: product.brandName, isActive: true }),
          session
        );

        if (!brand) {
          throw new ApiError(400, `${product.name} cannot be sold because its brand is inactive`);
        }

        const productId = String(product._id);
        const totalRequested = (requestedByProductId.get(productId) || 0) + Number(item.quantity || 0);
        requestedByProductId.set(productId, totalRequested);
        productById.set(productId, product);
        preparedLines.push({ item, product });
      }

      const stockErrors = [];
      for (const [productId, requestedQty] of requestedByProductId.entries()) {
        const product = productById.get(productId);

        if (product.stockQuantity < requestedQty) {
          stockErrors.push(
            `${product.name}: requested ${requestedQty}, available ${product.stockQuantity}`
          );
        }
      }

      if (stockErrors.length > 0) {
        const readableList = stockErrors.map((line) => `- ${line}`).join("\n");
        throw new ApiError(400, `Insufficient stock for the following items:\n${readableList}`);
      }

      for (const { item, product } of preparedLines) {

        const unitPrice = item.unitPrice ?? product.salePrice;
        const lineSubtotal = Number((item.quantity * unitPrice).toFixed(2));
        subtotal = Number((subtotal + lineSubtotal).toFixed(2));

        items.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          subtotal: lineSubtotal,
        });

        product.stockQuantity -= item.quantity;
        await saveWithOptionalSession(product, session);
      }

      const discount = payload.discount || 0;
      const tax = payload.tax || 0;
      const grandTotal = Number((subtotal - discount + tax).toFixed(2));

      if (grandTotal < 0) {
        throw new ApiError(400, "Grand total cannot be negative");
      }

      const paidAmount = payload.paidAmount ?? grandTotal;
      if (paidAmount > grandTotal) {
        throw new ApiError(400, "Paid amount cannot exceed grand total");
      }

      const sale = await createWithOptionalSession(
        SalesInvoice,
        [
          {
            invoiceNumber: buildInvoiceNumber("SAL"),
            customerId: payload.customerId || null,
            generatedById: creatorId || null,
            generatedByName: creatorName || "Unknown User",
            date: payload.date,
            items,
            subtotal,
            discount,
            tax,
            grandTotal,
            paymentMethod: payload.paymentMethod,
            paymentStatus: payload.paymentStatus,
            paidAmount,
          },
        ],
        session
      );

      const receivable = Number((grandTotal - paidAmount).toFixed(2));
      if (customer && receivable > 0) {
        customer.balance = Number((customer.balance + receivable).toFixed(2));
        await saveWithOptionalSession(customer, session);
      }

      return sale[0];
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

const addSalePayment = async (req, res, next) => {
  try {
    const processorId = req.user?.adminId || req.user?.id || req.user?._id || null;
    const processorName =
      String(req.user?.name || req.user?.username || req.user?.email || "").trim() || "Unknown User";

    const updated = await runWithOptionalTransaction(async (session) => {
      const { amount, paymentMethod } = req.validatedBody;

      const invoice = await applySession(SalesInvoice.findById(req.params.id), session);

      if (!invoice) {
        throw new ApiError(404, "Sale invoice not found");
      }

      const grandTotal = Number(invoice.grandTotal || 0);
      const paidAmount = Number(invoice.paidAmount || 0);
      const dueAmount = Number((grandTotal - paidAmount).toFixed(2));

      if (dueAmount <= 0) {
        throw new ApiError(400, "This invoice is already fully paid");
      }

      if (amount > dueAmount) {
        throw new ApiError(400, "Payment amount cannot exceed remaining due");
      }

      invoice.paidAmount = Number((paidAmount + amount).toFixed(2));
      invoice.paymentStatus = invoice.paidAmount >= grandTotal ? "paid" : "partial";

      if (paymentMethod) {
        invoice.paymentMethod = paymentMethod;
      }

      await saveWithOptionalSession(invoice, session);

      if (invoice.customerId) {
        const customer = await applySession(Customer.findById(invoice.customerId), session);

        if (customer) {
          customer.balance = Number(Math.max(0, customer.balance - amount).toFixed(2));
          await saveWithOptionalSession(customer, session);

          await createWithOptionalSession(
            DuePayment,
            [
              {
                mode: "receivable",
                sourceInvoiceType: "sale",
                sourceInvoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                partyType: "customer",
                partyId: customer._id,
                partyName: customer.name,
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
      }

      const hydrated = await applySession(
        SalesInvoice.findById(invoice._id)
          .populate("customerId", "name phone")
          .populate("generatedById", "name username role")
          .populate("items.productId", "name"),
        session
      );

      return hydrated;
    });

    res.json({ success: true, data: updated, message: "Payment recorded successfully" });
  } catch (error) {
    next(error);
  }
};

const getSales = async (req, res, next) => {
  try {
    const { customerId, fromDate, toDate } = req.query;
    const query = {};

    if (customerId) {
      query.customerId = customerId;
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

    const sales = await SalesInvoice.find(query)
      .populate("customerId", "name phone")
      .populate("generatedById", "name username role")
      .populate("items.productId", "name")
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
};

const getSaleById = async (req, res, next) => {
  try {
    const sale = await SalesInvoice.findById(req.params.invoiceId)
      .populate("customerId", "name phone")
      .populate("generatedById", "name username role")
      .populate("items.productId", "name");

    if (!sale) {
      throw new ApiError(404, "Sale invoice not found");
    }

    res.json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  addSalePayment,
};
