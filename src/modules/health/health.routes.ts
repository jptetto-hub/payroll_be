import { Router } from "express";
import { Role } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { HealthController } from "./health.controller";

const router = Router();

router.get("/system", HealthController.system);

router.get(
  "/queues",
  authMiddleware,
  allowRoles(Role.SUPER_ADMIN),
  HealthController.queues,
);

router.get(
  "/workers",
  authMiddleware,
  allowRoles(Role.SUPER_ADMIN),
  HealthController.workers,
);

export default router;
