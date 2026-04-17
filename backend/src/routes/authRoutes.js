const express = require("express");

const { bootstrapAdmin, login, getSession } = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const { bootstrapAuthSchema, loginSchema } = require("./schemas");

const router = express.Router();

router.post("/bootstrap", validateBody(bootstrapAuthSchema), bootstrapAdmin);
router.post("/login", validateBody(loginSchema), login);
router.get("/session", requireAuth, getSession);

module.exports = router;
