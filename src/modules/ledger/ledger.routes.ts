import { Router } from "express";
import { Role } from "@prisma/client";
import { LedgerController } from "./ledger.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  LedgerController.list,
);

router.get("/my", allowRoles(Role.USER), LedgerController.my);

router.get(
  "/employee/:employeeId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  LedgerController.employeeLedger,
);

router.get(
  "/payroll/:payrollId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  LedgerController.payrollLedger,
);

export default router;
