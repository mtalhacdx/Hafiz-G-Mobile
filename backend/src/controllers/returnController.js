const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Admin = require("../models/Admin");
const SalesInvoice = require("../models/SalesInvoice");
const ProductReturn = require("../models/ProductReturn");
const { ApiError } = require("../utils/apiError");
const { buildInvoiceNumber } = require("../utils/invoiceNumber");
const {
  runWithOptionalTransaction,
  applySession,
  saveWithOptionalSession,
  createWithOptionalSession,
} = require("../utils/transaction");

const createReturn = async (req, res, next) => {
  try {
    const created = await runWithOptionalTransaction(async (session) => {
      const receiverIdCandidate = req.user?.adminId || req.user?.id || req.user?._id || null;
      let receiverName = String(req.user?.name || req.user?.username || req.user?.email || "").trim();
      let receiverId = receiverIdCandidate;
      let receiverAccount = null;

      if (receiverIdCandidate) {
        receiverAccount = await applySession(
          Admin.findById(receiverIdCandidate).select("_id name username"),
          session
        );
      }

      if (!receiverAccount && (req.user?.username || req.user?.email)) {
        const filters = [];
        if (req.user?.username) {
          filters.push({ username: String(req.user.username).toLowerCase().trim() });
        }
        if (req.user?.email) {
          filters.push({ email: String(req.user.email).toLowerCase().trim() });
        }

        if (filters.length > 0) {
          receiverAccount = await applySession(
            Admin.findOne({ $or: filters }).select("_id name username"),
            session
          );
        }
      }

      if (receiverAccount) {
        receiverId = receiverAccount._id;
        receiverName = String(receiverAccount.name || receiverAccount.username || receiverName || "").trim();
      }

      const payload = req.validatedBody;

      const sale = await applySession(
        SalesInvoice.findById(payload.saleInvoiceId)
          .populate("items.productId", "name")
          .populate("customerId", "name"),
        session
      );

      if (!sale) {
        throw new ApiError(404, "Sale invoice not found");
      }

      const soldQtyMap = sale.items.reduce((acc, line) => {
        const productId = String(line.productId?._id || line.productId);
        acc[productId] = (acc[productId] || 0) + Number(line.quantity || 0);
        return acc;
      }, {});

      const aggregate = ProductReturn.aggregate([
        { $match: { saleInvoiceId: sale._id } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            quantity: { $sum: "$items.quantity" },
          },
        },
      ]);

      if (session) {
        aggregate.session(session);
      }

      const alreadyReturned = await aggregate;
      const returnedQtyMap = alreadyReturned.reduce((acc, row) => {
        acc[String(row._id)] = Number(row.quantity || 0);
        return acc;
      }, {});

      let totalAmount = 0;
      const returnItems = [];

      for (const requestedItem of payload.items) {
        const productId = String(requestedItem.productId);
        const soldQty = Number(soldQtyMap[productId] || 0);
        const returnedQty = Number(returnedQtyMap[productId] || 0);
        const availableQty = soldQty - returnedQty;

        if (soldQty <= 0) {
          throw new ApiError(400, "Selected product does not exist in this invoice");
        }

        if (requestedItem.quantity > availableQty) {
          throw new ApiError(400, "Return quantity exceeds available returnable quantity");
        }

        const saleLine = sale.items.find(
          (line) => String(line.productId?._id || line.productId) === productId
        );

        if (!saleLine) {
          throw new ApiError(400, "Invalid product line selected for return");
        }

        const product = await applySession(
          Product.findOne({ _id: requestedItem.productId, isActive: true }),
          session
        );

        if (!product) {
          throw new ApiError(404, "Product not found");
        }

        product.stockQuantity += requestedItem.quantity;
        await saveWithOptionalSession(product, session);

        const unitPrice = Number(saleLine.unitPrice || 0);
        const subtotal = Number((unitPrice * requestedItem.quantity).toFixed(2));
        totalAmount = Number((totalAmount + subtotal).toFixed(2));

        returnItems.push({
          productId: requestedItem.productId,
          quantity: requestedItem.quantity,
          unitPrice,
          subtotal,
          reason: requestedItem.reason || "",
        });
      }

      const createdReturn = await createWithOptionalSession(
        ProductReturn,
        [
          {
            returnNumber: buildInvoiceNumber("RET"),
            saleInvoiceId: payload.saleInvoiceId,
            customerId: sale.customerId?._id || null,
            receivedById: receiverId || null,
            receivedByName: receiverName || "Unknown User",
            date: payload.date,
            items: returnItems,
            totalAmount,
            refundMethod: payload.refundMethod,
            notes: payload.notes || "",
          },
        ],
        session
      );

      if (sale.customerId?._id) {
        const customer = await applySession(Customer.findById(sale.customerId._id), session);
        if (customer) {
          customer.balance = Math.max(0, Number(customer.balance || 0) - totalAmount);
          await saveWithOptionalSession(customer, session);
        }
      }

      return createdReturn[0];
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

const getReturns = async (req, res, next) => {
  try {
    const { search, fromDate, toDate, saleInvoiceId } = req.query;
    const query = {};

    if (saleInvoiceId) {
      query.saleInvoiceId = saleInvoiceId;
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

    if (search?.trim()) {
      query.returnNumber = { $regex: search.trim(), $options: "i" };
    }

    const rows = await ProductReturn.find(query)
      .populate("saleInvoiceId", "invoiceNumber")
      .populate("customerId", "name phone")
      .populate("receivedById", "name username role")
      .populate("items.productId", "name")
      .sort({ date: -1, createdAt: -1 });

    const filtered = search?.trim()
      ? rows.filter((row) => {
          const q = search.trim().toLowerCase();
          const customerName = row.customerId?.name?.toLowerCase() || "";
          const invoiceNumber = row.saleInvoiceId?.invoiceNumber?.toLowerCase() || "";
          return (
            row.returnNumber?.toLowerCase().includes(q) ||
            customerName.includes(q) ||
            invoiceNumber.includes(q)
          );
        })
      : rows;

    res.json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReturn,
  getReturns,
};
