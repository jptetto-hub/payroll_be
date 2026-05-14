import { Router } from "express";
import { Role } from "@prisma/client";
import { SalaryCalculationController } from "./salary-calculation.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { salaryCalculationPreviewSchema } from "./salary-calculation.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/preview",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(salaryCalculationPreviewSchema),
  SalaryCalculationController.preview,
);

export default router;
