import { Router } from "express";
import { Role } from "@prisma/client";
import { PayrollController } from "./payroll.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  deletePayrollSchema,
  generatePayrollSchema,
  recalculatePayrollSchema,
} from "./payroll.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/generate",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(generatePayrollSchema),
  PayrollController.generate,
);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  PayrollController.list,
);

router.get(
  "/employee/:employeeId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  PayrollController.listByEmployee,
);

router.post(
  "/:id/recalculate",
  allowRoles(Role.SUPER_ADMIN),
  validate(recalculatePayrollSchema),
  PayrollController.recalculate,
);

router.delete(
  "/:id",
  allowRoles(Role.SUPER_ADMIN),
  validate(deletePayrollSchema),
  PayrollController.delete,
);

router.get(
  "/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  PayrollController.getById,
);

export default router;
