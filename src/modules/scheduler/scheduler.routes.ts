import { Router } from "express";
import { Role } from "@prisma/client";
import { SchedulerController } from "./scheduler.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";

const router = Router();

router.use(authMiddleware);

router.post(
  "/run-payroll",
  allowRoles(Role.SUPER_ADMIN),
  SchedulerController.runPayroll,
);

router.get("/runs", allowRoles(Role.SUPER_ADMIN), SchedulerController.runs);

export default router;
