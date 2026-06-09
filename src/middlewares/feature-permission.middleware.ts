import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { SettingsService } from "../modules/settings/settings.service";
import { ConfigurablePermissionKey } from "../modules/settings/role-permissions";

export const requireFeaturePermission =
  (permission: ConfigurablePermissionKey) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role === Role.SUPER_ADMIN) {
        return next();
      }

      const permissions = await SettingsService.getRolePermissions();

      if (!permissions[req.user.role]?.[permission]) {
        return next(
          new Error(`Forbidden: ${permission} permission is disabled for your role`),
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
