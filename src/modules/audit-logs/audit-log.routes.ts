import { Router } from "express";
import { Role } from "@prisma/client";
import { AuditLogController } from "./audit-log.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AuditLogController.list,
);

router.get(
  "/export",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AuditLogController.export,
);

router.get(
  "/user/:userId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AuditLogController.listByUser,
);

router.get(
  "/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AuditLogController.getById,
);

export default router;
