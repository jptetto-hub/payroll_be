import { Router } from "express";
import { Role } from "@prisma/client";
import { EmployeeController } from "./employee.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateRoleSchema,
  updateStatusSchema,
} from "./employee.validator";
import { requireFeaturePermission } from "../../middlewares/feature-permission.middleware";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  requireFeaturePermission("EMPLOYEES"),
  validate(createEmployeeSchema),
  EmployeeController.create,
);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  requireFeaturePermission("EMPLOYEES"),
  EmployeeController.list,
);

router.get(
  "/options",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  EmployeeController.options,
);

router.get(
  "/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  EmployeeController.getById,
);

router.patch(
  "/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  requireFeaturePermission("EMPLOYEES"),
  validate(updateEmployeeSchema),
  EmployeeController.update,
);

router.patch(
  "/:id/status",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  requireFeaturePermission("EMPLOYEES"),
  validate(updateStatusSchema),
  EmployeeController.updateStatus,
);

router.patch(
  "/:id/role",
  allowRoles(Role.SUPER_ADMIN),
  validate(updateRoleSchema),
  EmployeeController.updateRole,
);

export default router;
