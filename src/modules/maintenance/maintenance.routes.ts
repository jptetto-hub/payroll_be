import { Router } from "express";
import { Role } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { MaintenanceController } from "./maintenance.controller";
import { sensitiveActionRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

router.post(
  "/cleanup",
  authMiddleware,
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  MaintenanceController.cleanup,
);

router.post(
  "/partitions/next-month",
  authMiddleware,
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  MaintenanceController.prepareNextMonthPartitions,
);

export default router;
