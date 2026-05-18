import { Router } from "express";
import { Role } from "@prisma/client";
import { SettingsController } from "./settings.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createWorkHourSettingSchema,
  updateSettingsSchema,
  updateWorkHourSettingSchema,
} from "./settings.validator";

const router = Router();

router.use(authMiddleware);

router.get("/", allowRoles(Role.SUPER_ADMIN), SettingsController.get);

router.get(
  "/work-hours",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  SettingsController.listWorkHourSettings,
);

router.post(
  "/work-hours",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(createWorkHourSettingSchema),
  SettingsController.createWorkHourSetting,
);

router.patch(
  "/work-hours/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(updateWorkHourSettingSchema),
  SettingsController.updateWorkHourSetting,
);

router.delete(
  "/work-hours/:id",
  allowRoles(Role.SUPER_ADMIN),
  SettingsController.deleteWorkHourSetting,
);

router.patch(
  "/",
  allowRoles(Role.SUPER_ADMIN),
  validate(updateSettingsSchema),
  SettingsController.update,
);

export default router;
