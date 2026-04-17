const express = require("express");

const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { categoryCreateSchema, categoryUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getCategories);
router.post("/", requireRole("admin"), validateBody(categoryCreateSchema), createCategory);
router.put("/:id", requireRole("admin"), validateBody(categoryUpdateSchema), updateCategory);
router.delete("/:id", requireRole("admin"), deleteCategory);

module.exports = router;
