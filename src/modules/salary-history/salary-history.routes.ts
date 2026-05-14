import { Router } from "express";
import { Role } from "@prisma/client";
import { SalaryHistoryController } from "./salary-history.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createSalaryHistorySchema,
  resolveSalarySchema,
  updateSalaryHistorySchema,
} from "./salary-history.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(createSalaryHistorySchema),
  SalaryHistoryController.create,
);

router.get(
  "/employee/:employeeId",
  allowRoles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  SalaryHistoryController.listByEmployee,
);

router.get(
  "/employee/:employeeId/current",
  allowRoles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  SalaryHistoryController.current,
);

router.get(
  "/employee/:employeeId/resolve",
  allowRoles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  validate(resolveSalarySchema),
  SalaryHistoryController.resolve,
);

router.patch(
  "/:id",
  allowRoles(Role.SUPER_ADMIN),
  validate(updateSalaryHistorySchema),
  SalaryHistoryController.update,
);

router.delete(
  "/:id",
  allowRoles(Role.SUPER_ADMIN),
  SalaryHistoryController.delete,
);

export default router;
