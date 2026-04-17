const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const Admin = require("../models/Admin");
const SalesInvoice = require("../models/SalesInvoice");
const PurchaseInvoice = require("../models/PurchaseInvoice");
const Claim = require("../models/Claim");
const { ApiError } = require("../utils/apiError");
const { buildInvoiceNumber } = require("../utils/invoiceNumber");
const {
  runWithOptionalTransaction,
  applySession,
  saveWithOptionalSession,
  createWithOptionalSession,
} = require("../utils/transaction");

const ensureTransition = (claim, nextStatus) => {
  const current = claim.status;

  if (nextStatus === "sent_to_supplier" && current !== "pending") {
    throw new ApiError(400, "Only pending claims can be sent to supplier");
  }

  if ((nextStatus === "accepted" || nextStatus === "rejected") && current !== "sent_to_supplier") {
    throw new ApiError(400, "Only sent claims can be marked accepted or rejected");
  }

  if (nextStatus === "closed") {
    throw new ApiError(400, "Manual close is deprecated. Accepted or rejected claims are auto-complete.");
  }
};

const getLatestPurchaseForProduct = async (productId, session) => {
  return applySession(
    PurchaseInvoice.findOne({ "items.productId": productId })
      .populate("supplierId", "name isActive")
      .sort({ date: -1, createdAt: -1 }),
    session
  );
};

const createClaim = async (req, res, next) => {
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
        SalesInvoice.findById(payload.invoiceId).populate("items.productId", "name"),
        session
      );

      if (!sale) {
        throw new ApiError(404, "Sale invoice not found");
      }

      const product = await applySession(
        Product.findOne({ _id: payload.productId, isActive: true }).populate("categoryId", "categoryName isActive"),
        session
      );

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      const soldQty = (sale.items || [])
        .filter((line) => String(line.productId?._id || line.productId) === String(payload.productId))
        .reduce((sum, line) => sum + Number(line.quantity || 0), 0);

      if (soldQty <= 0) {
        throw new ApiError(400, "Selected product does not exist in this sale invoice");
      }

      const aggregate = Claim.aggregate([
        {
          $match: {
            invoiceId: sale._id,
            productId: product._id,
          },
        },
        {
          $group: {
            _id: null,
            totalQty: { $sum: "$quantity" },
          },
        },
      ]);

      if (session) {
        aggregate.session(session);
      }

      const alreadyClaimedRows = await aggregate;
      const alreadyClaimedQty = Number(alreadyClaimedRows[0]?.totalQty || 0);
      const claimableQty = soldQty - alreadyClaimedQty;

      if (payload.quantity > claimableQty) {
        throw new ApiError(400, `Claim quantity exceeds allowed quantity. Allowed: ${claimableQty}`);
      }

      if (payload.replacementGiven && product.stockQuantity < payload.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for replacement. Requested: ${payload.quantity}, Available: ${product.stockQuantity}`
        );
      }

      const purchaseInvoice = payload.purchaseInvoiceId
        ? await applySession(
            PurchaseInvoice.findById(payload.purchaseInvoiceId).populate("supplierId", "name isActive"),
            session
          )
        : await getLatestPurchaseForProduct(product._id, session);

      if (payload.purchaseInvoiceId && !purchaseInvoice) {
        throw new ApiError(404, "Purchase invoice not found");
      }

      const supplierIdFromPurchase = purchaseInvoice?.supplierId?._id || purchaseInvoice?.supplierId || null;
      const fallbackSupplierId = product.supplierId || null;
      const resolvedSupplierId = supplierIdFromPurchase || fallbackSupplierId;

      const supplier = resolvedSupplierId
        ? await applySession(Supplier.findById(resolvedSupplierId), session)
        : null;

      if (supplier && supplier.isActive === false) {
        throw new ApiError(400, "Linked supplier for this claim is not active");
      }

      const customer = sale.customerId
        ? await applySession(Customer.findById(sale.customerId), session)
        : null;

      product.claimStockQuantity = Number((Number(product.claimStockQuantity || 0) + payload.quantity).toFixed(2));
      if (payload.replacementGiven) {
        product.stockQuantity = Number((Number(product.stockQuantity || 0) - payload.quantity).toFixed(2));
      }
      await saveWithOptionalSession(product, session);

      const createdRows = await createWithOptionalSession(
        Claim,
        [
          {
            claimNumber: buildInvoiceNumber("CLM"),
            invoiceId: sale._id,
            purchaseInvoiceId: purchaseInvoice?._id || null,
            customerId: customer?._id || null,
            supplierId: supplier?._id || null,
            receivedById: receiverId || null,
            receivedByName: receiverName || "Unknown User",
            productId: product._id,
            quantity: payload.quantity,
            reason: payload.reason,
            replacementGiven: payload.replacementGiven,
            refundGiven: payload.refundGiven,
            refundAmount: payload.refundGiven ? payload.refundAmount : 0,
            status: "pending",
            supplierStatus: "pending",
            purchasePrice: Number(product.purchasePrice || 0),
            lossAmount: 0,
            notes: payload.notes || "",
          },
        ],
        session
      );

      const hydrated = await applySession(
        Claim.findById(createdRows[0]._id)
          .populate("invoiceId", "invoiceNumber")
          .populate("purchaseInvoiceId", "purchaseInvoiceNumber")
          .populate("customerId", "name phone")
          .populate("supplierId", "name phone")
          .populate("receivedById", "name username role")
          .populate("productId", "name"),
        session
      );

      return hydrated;
    });

    res.status(201).json({ success: true, data: created, message: "Claim created successfully" });
  } catch (error) {
    next(error);
  }
};

const getClaims = async (req, res, next) => {
  try {
    const { search, status, supplierStatus, supplierId, fromDate, toDate } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (supplierStatus) {
      query.supplierStatus = supplierStatus;
    }

    if (supplierId) {
      query.supplierId = supplierId;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.createdAt.$lte = new Date(toDate);
      }
    }

    const claims = await Claim.find(query)
      .populate("invoiceId", "invoiceNumber")
      .populate("purchaseInvoiceId", "purchaseInvoiceNumber")
      .populate("customerId", "name phone")
      .populate("supplierId", "name phone")
      .populate("receivedById", "name username role")
      .populate("productId", "name")
      .sort({ createdAt: -1, updatedAt: -1 });

    const filtered = search?.trim()
      ? claims.filter((row) => {
          const q = search.trim().toLowerCase();
          return (
            row.claimNumber?.toLowerCase().includes(q) ||
            row.invoiceId?.invoiceNumber?.toLowerCase().includes(q) ||
            row.customerId?.name?.toLowerCase().includes(q) ||
            row.supplierId?.name?.toLowerCase().includes(q) ||
            row.productId?.name?.toLowerCase().includes(q)
          );
        })
      : claims;

    res.json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

const sendToSupplier = async (req, res, next) => {
  try {
    const updated = await runWithOptionalTransaction(async (session) => {
      const claim = await applySession(Claim.findById(req.params.id), session);

      if (!claim) {
        throw new ApiError(404, "Claim not found");
      }

      if (!claim.supplierId) {
        let resolvedSupplierId = null;

        if (claim.purchaseInvoiceId) {
          const purchaseInvoice = await applySession(
            PurchaseInvoice.findById(claim.purchaseInvoiceId).populate("supplierId", "isActive"),
            session
          );
          resolvedSupplierId = purchaseInvoice?.supplierId?._id || purchaseInvoice?.supplierId || null;
        }

        if (!resolvedSupplierId && claim.productId) {
          const product = await applySession(Product.findById(claim.productId).select("supplierId"), session);
          resolvedSupplierId = product?.supplierId || null;
        }

        if (!resolvedSupplierId) {
          throw new ApiError(400, "No linked supplier found for this claim");
        }

        const supplier = await applySession(Supplier.findById(resolvedSupplierId), session);
        if (!supplier || supplier.isActive === false) {
          throw new ApiError(400, "Linked supplier for this claim is not active");
        }

        claim.supplierId = supplier._id;
        await saveWithOptionalSession(claim, session);
      }

      ensureTransition(claim, "sent_to_supplier");

      claim.status = "sent_to_supplier";
      claim.supplierStatus = "pending";
      await saveWithOptionalSession(claim, session);

      return applySession(
        Claim.findById(claim._id)
          .populate("invoiceId", "invoiceNumber")
          .populate("purchaseInvoiceId", "purchaseInvoiceNumber")
          .populate("customerId", "name phone")
          .populate("supplierId", "name phone")
          .populate("receivedById", "name username role")
          .populate("productId", "name"),
        session
      );
    });

    res.json({ success: true, data: updated, message: "Claim sent to supplier" });
  } catch (error) {
    next(error);
  }
};

const acceptClaim = async (req, res, next) => {
  try {
    const updated = await runWithOptionalTransaction(async (session) => {
      const claim = await applySession(Claim.findById(req.params.id), session);

      if (!claim) {
        throw new ApiError(404, "Claim not found");
      }

      ensureTransition(claim, "accepted");

      const product = await applySession(Product.findById(claim.productId), session);
      if (!product) {
        throw new ApiError(404, "Product not found for claim");
      }

      if (Number(product.claimStockQuantity || 0) < Number(claim.quantity || 0)) {
        throw new ApiError(400, "Claim stock is inconsistent for this product");
      }

      product.claimStockQuantity = Number((Number(product.claimStockQuantity || 0) - Number(claim.quantity || 0)).toFixed(2));
      await saveWithOptionalSession(product, session);

      claim.status = "accepted";
      claim.supplierStatus = "accepted";
      claim.lossAmount = 0;
      await saveWithOptionalSession(claim, session);

      return applySession(
        Claim.findById(claim._id)
          .populate("invoiceId", "invoiceNumber")
          .populate("purchaseInvoiceId", "purchaseInvoiceNumber")
          .populate("customerId", "name phone")
          .populate("supplierId", "name phone")
          .populate("receivedById", "name username role")
          .populate("productId", "name"),
        session
      );
    });

    res.json({ success: true, data: updated, message: "Claim accepted by supplier" });
  } catch (error) {
    next(error);
  }
};

const rejectClaim = async (req, res, next) => {
  try {
    const updated = await runWithOptionalTransaction(async (session) => {
      const claim = await applySession(Claim.findById(req.params.id), session);

      if (!claim) {
        throw new ApiError(404, "Claim not found");
      }

      ensureTransition(claim, "rejected");

      const product = await applySession(Product.findById(claim.productId), session);
      if (!product) {
        throw new ApiError(404, "Product not found for claim");
      }

      if (Number(product.claimStockQuantity || 0) < Number(claim.quantity || 0)) {
        throw new ApiError(400, "Claim stock is inconsistent for this product");
      }

      product.claimStockQuantity = Number((Number(product.claimStockQuantity || 0) - Number(claim.quantity || 0)).toFixed(2));
      await saveWithOptionalSession(product, session);

      claim.status = "rejected";
      claim.supplierStatus = "rejected";
      claim.lossAmount = Number((Number(claim.quantity || 0) * Number(claim.purchasePrice || 0)).toFixed(2));
      claim.notes = req.validatedBody.notes || claim.notes || "";
      await saveWithOptionalSession(claim, session);

      return applySession(
        Claim.findById(claim._id)
          .populate("invoiceId", "invoiceNumber")
          .populate("purchaseInvoiceId", "purchaseInvoiceNumber")
          .populate("customerId", "name phone")
          .populate("supplierId", "name phone")
          .populate("receivedById", "name username role")
          .populate("productId", "name"),
        session
      );
    });

    res.json({ success: true, data: updated, message: "Claim rejected by supplier" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createClaim,
  getClaims,
  sendToSupplier,
  acceptClaim,
  rejectClaim,
};
