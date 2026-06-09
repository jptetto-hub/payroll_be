import { Router } from "express";
import { Role } from "@prisma/client";
import { AdvanceController } from "./advance.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  advanceDeductionPreviewSchema,
  createAdvanceSchema,
  cycleQuerySchema,
  deleteAdvanceSchema,
  manualDeductionCycleQuerySchema,
  updateAdvanceSchema,
  upsertManualDeductionSchema,
} from "./advance.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(createAdvanceSchema),
  AdvanceController.create,
);

router.post(
  "/deduction-preview",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(advanceDeductionPreviewSchema),
  AdvanceController.deductionPreview,
);

router.put(
  "/manual-deductions",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(upsertManualDeductionSchema),
  AdvanceController.upsertManualDeduction,
);

router.delete(
  "/manual-deductions/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AdvanceController.deleteManualDeduction,
);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  AdvanceController.list,
);

router.get("/my", allowRoles(Role.USER), AdvanceController.my);

router.get(
  "/employee/:employeeId/cycle",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(cycleQuerySchema),
  AdvanceController.listByCycle,
);

router.get(
  "/employee/:employeeId/manual-deduction",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(manualDeductionCycleQuerySchema),
  AdvanceController.getManualDeduction,
);

router.get(
  "/employee/:employeeId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AdvanceController.listByEmployee,
);

router.get("/:id", AdvanceController.getById);

router.patch(
  "/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(updateAdvanceSchema),
  AdvanceController.update,
);

router.delete(
  "/:id",
  allowRoles(Role.SUPER_ADMIN),
  validate(deleteAdvanceSchema),
  AdvanceController.delete,
);

export default router;
