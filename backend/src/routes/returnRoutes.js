const express = require("express");

const { createReturn, getReturns } = require("../controllers/returnController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { returnCreateSchema } = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", getReturns);
router.post("/", validateBody(returnCreateSchema), createReturn);

module.exports = router;
