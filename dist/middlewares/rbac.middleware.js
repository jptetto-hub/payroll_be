"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowRoles = void 0;
const allowRoles = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new Error("Unauthorized"));
        }
        if (!roles.includes(req.user.role)) {
            return next(new Error("Forbidden: insufficient permission"));
        }
        next();
    };
};
exports.allowRoles = allowRoles;
//# sourceMappingURL=rbac.middleware.js.map