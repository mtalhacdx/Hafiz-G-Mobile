const express = require("express");

const {
  createCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { customerCreateSchema, customerUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getCustomers);
router.post("/", validateBody(customerCreateSchema), createCustomer);
router.put("/:id", validateBody(customerUpdateSchema), updateCustomer);
router.delete("/:id", requireRole("admin"), deleteCustomer);

module.exports = router;
