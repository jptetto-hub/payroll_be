"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.get("/admin-test", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), (_req, res) => {
    res.json({
        success: true,
        message: "ADMIN or SUPER_ADMIN access granted",
    });
});
router.get("/super-admin-test", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.allowRoles)(client_1.Role.SUPER_ADMIN), (_req, res) => {
    res.json({
        success: true,
        message: "SUPER_ADMIN access granted",
    });
});
exports.default = router;
//# sourceMappingURL=rbac-test.routes.js.map