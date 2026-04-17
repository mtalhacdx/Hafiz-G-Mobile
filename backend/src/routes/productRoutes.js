const express = require("express");

const {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { productCreateSchema, productUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getProducts);
router.post("/", requireRole("admin"), validateBody(productCreateSchema), createProduct);
router.put("/:id", requireRole("admin"), validateBody(productUpdateSchema), updateProduct);
router.delete("/:id", requireRole("admin"), deleteProduct);

module.exports = router;
