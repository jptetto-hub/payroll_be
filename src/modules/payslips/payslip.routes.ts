import { Router } from "express";
import { Role } from "@prisma/client";
import { PayslipController } from "./payslip.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  PayslipController.list,
);

router.get("/my", allowRoles(Role.USER), PayslipController.my);

router.get(
  "/payroll/:payrollId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  PayslipController.getByPayroll,
);

router.get(
  "/employee/:employeeId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  PayslipController.listByEmployee,
);

router.get("/:id", PayslipController.getById);

export default router;
