import { Router } from "express";
import { Role } from "@prisma/client";
import { DashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { cacheForSeconds } from "../../middlewares/cacheHeaders.middleware";

const router = Router();

router.post(
  "/summary/refresh",
  authMiddleware,
  allowRoles(Role.SUPER_ADMIN),
  DashboardController.refreshSummary,
);
router.get(
  "/summary",
  authMiddleware,
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  cacheForSeconds(30),
  DashboardController.summary,
);
router.get(
  "/recent-payroll",
  authMiddleware,
  cacheForSeconds(30),
  DashboardController.recentPayroll,
);
router.get(
  "/recent-activities",
  authMiddleware,
  cacheForSeconds(30),
  DashboardController.recentActivities,
);
router.get(
  "/analytics",
  authMiddleware,
  cacheForSeconds(60),
  DashboardController.analytics,
);
router.get("/", authMiddleware, DashboardController.summary);

export default router;
