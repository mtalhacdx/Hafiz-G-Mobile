const express = require("express");

const {
	changePassword,
	applyLowStockThreshold,
	resetSystemData,
	resetMasterData,
	listManagerUsers,
	createManagerUser,
	resetManagerPassword,
	updateManagerStatus,
	deleteManagerUser,
} = require("../controllers/settingsController");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { validateBody } = require("../middlewares/validate");
const {
	passwordChangeSchema,
	managerCreateSchema,
	managerResetPasswordSchema,
	managerStatusSchema,
} = require("./schemas");

const router = express.Router();

router.use(requireAuth);

router.post("/change-password", validateBody(passwordChangeSchema), changePassword);
router.post("/apply-low-stock-threshold", requireRole("admin"), applyLowStockThreshold);
router.post("/reset-system-data", requireRole("admin"), resetSystemData);
router.post("/reset-master-data", requireRole("admin"), resetMasterData);
router.get("/users", requireRole("admin"), listManagerUsers);
router.post("/users", requireRole("admin"), validateBody(managerCreateSchema), createManagerUser);
router.patch(
	"/users/:id/reset-password",
	requireRole("admin"),
	validateBody(managerResetPasswordSchema),
	resetManagerPassword
);
router.patch("/users/:id/status", requireRole("admin"), validateBody(managerStatusSchema), updateManagerStatus);
router.delete("/users/:id", requireRole("admin"), deleteManagerUser);

module.exports = router;
