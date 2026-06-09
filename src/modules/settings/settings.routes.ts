import { Router } from "express";
import { Role } from "@prisma/client";
import { SettingsController } from "./settings.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createWorkHourSettingSchema,
  updateOrganizationTimezoneSchema,
  updateRolePermissionsSchema,
  updateSettingsSchema,
  updateWorkHourSettingSchema,
} from "./settings.validator";
import { sensitiveActionRateLimiter } from "../../middlewares/rateLimit.middleware";
import { requireFeaturePermission } from "../../middlewares/feature-permission.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/permissions/me", SettingsController.getMyPermissions);

router.get(
  "/permissions",
  allowRoles(Role.SUPER_ADMIN),
  SettingsController.getRolePermissions,
);

router.put(
  "/permissions",
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  validate(updateRolePermissionsSchema),
  SettingsController.updateRolePermissions,
);

router.get("/", allowRoles(Role.SUPER_ADMIN), SettingsController.get);

router.patch(
  "/timezone",
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  validate(updateOrganizationTimezoneSchema),
  SettingsController.updateTimezone,
);

router.get(
  "/work-hours",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  SettingsController.listWorkHourSettings,
);

router.post(
  "/work-hours",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  requireFeaturePermission("SETTINGS"),
  sensitiveActionRateLimiter,
  validate(createWorkHourSettingSchema),
  SettingsController.createWorkHourSetting,
);

router.patch(
  "/work-hours/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  requireFeaturePermission("SETTINGS"),
  sensitiveActionRateLimiter,
  validate(updateWorkHourSettingSchema),
  SettingsController.updateWorkHourSetting,
);

router.delete(
  "/work-hours/:id",
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  SettingsController.deleteWorkHourSetting,
);

router.patch(
  "/",
  allowRoles(Role.SUPER_ADMIN),
  sensitiveActionRateLimiter,
  validate(updateSettingsSchema),
  SettingsController.update,
);

export default router;
