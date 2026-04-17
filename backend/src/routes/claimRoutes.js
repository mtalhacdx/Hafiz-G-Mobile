const express = require("express");

const {
  createClaim,
  getClaims,
  sendToSupplier,
  acceptClaim,
  rejectClaim,
} = require("../controllers/claimController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const {
  claimCreateSchema,
  claimSendSchema,
  claimAcceptSchema,
  claimRejectSchema,
} = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getClaims);
router.post("/", validateBody(claimCreateSchema), createClaim);
router.patch("/:id/send-to-supplier", validateBody(claimSendSchema), sendToSupplier);
router.patch("/:id/accept", validateBody(claimAcceptSchema), acceptClaim);
router.patch("/:id/reject", validateBody(claimRejectSchema), rejectClaim);

module.exports = router;
