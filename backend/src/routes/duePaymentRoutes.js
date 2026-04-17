const express = require("express");

const { getDuePayments } = require("../controllers/duePaymentController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getDuePayments);

module.exports = router;
