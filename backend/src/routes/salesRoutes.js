const express = require("express");

const { createSale, getSales, getSaleById, addSalePayment } = require("../controllers/salesController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { salesCreateSchema, salesPaymentUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getSales);
router.get("/:invoiceId", getSaleById);
router.post("/", validateBody(salesCreateSchema), createSale);
router.patch("/:id/payment", validateBody(salesPaymentUpdateSchema), addSalePayment);

module.exports = router;
