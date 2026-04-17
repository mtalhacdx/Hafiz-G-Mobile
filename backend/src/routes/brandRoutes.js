const express = require("express");

const { createBrand, getBrands, updateBrand, deleteBrand } = require("../controllers/brandController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { brandCreateSchema, brandUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getBrands);
router.post("/", requireRole("admin"), validateBody(brandCreateSchema), createBrand);
router.put("/:id", requireRole("admin"), validateBody(brandUpdateSchema), updateBrand);
router.delete("/:id", requireRole("admin"), deleteBrand);

module.exports = router;
