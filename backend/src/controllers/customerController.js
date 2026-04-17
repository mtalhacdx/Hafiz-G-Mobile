const Customer = require("../models/Customer");
const { ApiError } = require("../utils/apiError");

const createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.validatedBody);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

const getCustomers = async (req, res, next) => {
  try {
    const search = req.query.search?.trim();
    const includeInactive = req.query.includeInactive === "true";
    const query = includeInactive ? {} : { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.validatedBody, "balance")) {
      throw new ApiError(400, "Customer balance is system-managed");
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, req.validatedBody, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    res.json({ success: true, message: "Customer deactivated" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
};
