import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/summary", authMiddleware, DashboardController.summary);
router.get(
  "/recent-payroll",
  authMiddleware,
  DashboardController.recentPayroll,
);
router.get(
  "/recent-activities",
  authMiddleware,
  DashboardController.recentActivities,
);
router.get("/analytics", authMiddleware, DashboardController.analytics);
router.get("/", authMiddleware, DashboardController.summary);

export default router;
