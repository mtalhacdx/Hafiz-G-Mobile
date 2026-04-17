const express = require("express");

const {
	createPurchase,
	getPurchases,
	getPurchaseById,
	addPurchasePayment,
} = require("../controllers/purchaseController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { purchaseCreateSchema, purchasePaymentUpdateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getPurchases);
router.get("/:invoiceId", getPurchaseById);
router.post("/", requireRole("admin"), validateBody(purchaseCreateSchema), createPurchase);
router.patch("/:id/payment", requireRole("admin"), validateBody(purchasePaymentUpdateSchema), addPurchasePayment);

module.exports = router;
