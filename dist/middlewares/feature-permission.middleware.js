"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeaturePermission = void 0;
const client_1 = require("@prisma/client");
const settings_service_1 = require("../modules/settings/settings.service");
const requireFeaturePermission = (permission) => async (req, _res, next) => {
    try {
        if (!req.user || req.user.role === client_1.Role.SUPER_ADMIN) {
            return next();
        }
        const permissions = await settings_service_1.SettingsService.getRolePermissions();
        if (!permissions[req.user.role]?.[permission]) {
            return next(new Error(`Forbidden: ${permission} permission is disabled for your role`));
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireFeaturePermission = requireFeaturePermission;
//# sourceMappingURL=feature-permission.middleware.js.map