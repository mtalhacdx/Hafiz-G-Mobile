const { ZodError } = require("zod");
const { ApiError } = require("../utils/apiError");

const validateBody = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      next(new ApiError(400, first?.message || "Validation failed"));
      return;
    }

    next(error);
  }
};

module.exports = { validateBody };
