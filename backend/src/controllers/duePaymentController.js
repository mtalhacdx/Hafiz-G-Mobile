const DuePayment = require("../models/DuePayment");

const getDuePayments = async (req, res, next) => {
  try {
    const { mode, fromDate, toDate, search } = req.query;
    const query = {};

    if (mode && ["receivable", "payable"].includes(mode)) {
      query.mode = mode;
    }

    if (fromDate || toDate) {
      query.paidAt = {};
      if (fromDate) {
        query.paidAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.paidAt.$lte = new Date(toDate);
      }
    }

    if (search && search.trim()) {
      query.$or = [
        { invoiceNumber: { $regex: search.trim(), $options: "i" } },
        { partyName: { $regex: search.trim(), $options: "i" } },
        { paymentMethod: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const rows = await DuePayment.find(query)
      .populate("processedById", "name username role")
      .sort({ paidAt: -1, createdAt: -1 });

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDuePayments,
};
