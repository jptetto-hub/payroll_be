"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const ledger_controller_1 = require("./ledger.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN, client_1.Role.USER), ledger_controller_1.LedgerController.list);
router.get("/my", (0, rbac_middleware_1.allowRoles)(client_1.Role.USER), ledger_controller_1.LedgerController.my);
router.get("/employee/:employeeId", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), ledger_controller_1.LedgerController.employeeLedger);
router.get("/payroll/:payrollId", (0, rbac_middleware_1.allowRoles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN), ledger_controller_1.LedgerController.payrollLedger);
exports.default = router;
//# sourceMappingURL=ledger.routes.js.map