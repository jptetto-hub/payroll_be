import { Router } from "express";
import { Role } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { MaintenanceController } from "./maintenance.controller";
import { sensitiveActionRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

router.use(authMiddleware, allowRoles(Role.SUPER_ADMIN));

router.get("/restart/status", MaintenanceController.restartStatus);

router.post(
  "/restart",
  sensitiveActionRateLimiter,
  MaintenanceController.restartServices,
);

router.post(
  "/restart/dismiss",
  sensitiveActionRateLimiter,
  MaintenanceController.dismissRestart,
);

router.get("/backups", MaintenanceController.listBackups);

router.get("/backups/operations/:id", MaintenanceController.getBackupOperation);

router.post(
  "/backups",
  sensitiveActionRateLimiter,
  MaintenanceController.createBackup,
);

router.post(
  "/backups/restore",
  sensitiveActionRateLimiter,
  MaintenanceController.restoreBackup,
);

router.post(
  "/backups/cleanup",
  sensitiveActionRateLimiter,
  MaintenanceController.cleanupBackups,
);

router.post(
  "/database/clear",
  sensitiveActionRateLimiter,
  MaintenanceController.clearDatabase,
);

router.post(
  "/cleanup",
  sensitiveActionRateLimiter,
  MaintenanceController.cleanup,
);

router.post(
  "/partitions/next-month",
  sensitiveActionRateLimiter,
  MaintenanceController.prepareNextMonthPartitions,
);

export default router;
