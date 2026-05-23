import { Router } from "express";
import { Role } from "@prisma/client";
import { SchedulerController } from "./scheduler.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { sensitiveActionRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

router.use(authMiddleware);

router.post(
  "/run",
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  SchedulerController.runPayroll,
);

router.post(
  "/run-payroll",
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  SchedulerController.runPayroll,
);

router.get("/runs", allowRoles(Role.SUPER_ADMIN), SchedulerController.runs);
router.get(
  "/runs/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  SchedulerController.runStatus,
);

export default router;
