import { Router } from "express";
import { Role } from "@prisma/client";
import { SettingsController } from "./settings.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { updateSettingsSchema } from "./settings.validator";

const router = Router();

router.use(authMiddleware);

router.get("/", allowRoles(Role.SUPER_ADMIN), SettingsController.get);

router.patch(
  "/",
  allowRoles(Role.SUPER_ADMIN),
  validate(updateSettingsSchema),
  SettingsController.update,
);

export default router;
