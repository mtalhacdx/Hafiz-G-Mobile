const express = require("express");

const {
  createSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplierController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { supplierCreateSchema, supplierUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getSuppliers);
router.post("/", requireRole("admin"), validateBody(supplierCreateSchema), createSupplier);
router.put("/:id", requireRole("admin"), validateBody(supplierUpdateSchema), updateSupplier);
router.delete("/:id", requireRole("admin"), deleteSupplier);

module.exports = router;
