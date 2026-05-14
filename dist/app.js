"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const error_middleware_1 = require("./middlewares/error.middleware");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const rbac_test_routes_1 = __importDefault(require("./modules/auth/rbac-test.routes"));
const employee_routes_1 = __importDefault(require("./modules/employees/employee.routes"));
const salary_history_routes_1 = __importDefault(require("./modules/salary-history/salary-history.routes"));
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const attendance_request_routes_1 = __importDefault(require("./modules/attendance-requests/attendance-request.routes"));
const advance_routes_1 = __importDefault(require("./modules/advances/advance.routes"));
const salary_calculation_routes_1 = __importDefault(require("./modules/salary-calculation/salary-calculation.routes"));
const payroll_routes_1 = __importDefault(require("./modules/payroll/payroll.routes"));
const payslip_routes_1 = __importDefault(require("./modules/payslips/payslip.routes"));
const ledger_routes_1 = __importDefault(require("./modules/ledger/ledger.routes"));
const scheduler_routes_1 = __importDefault(require("./modules/scheduler/scheduler.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const audit_log_routes_1 = __importDefault(require("./modules/audit-logs/audit-log.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.json({
        success: true,
        message: "Payroll Attendance API running",
    });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/test", rbac_test_routes_1.default);
app.use("/api/employees", employee_routes_1.default);
app.use("/api/salary-history", salary_history_routes_1.default);
app.use("/api/attendance", attendance_routes_1.default);
app.use("/api/attendance-requests", attendance_request_routes_1.default);
app.use("/api/advances", advance_routes_1.default);
app.use("/api/salary-calculation", salary_calculation_routes_1.default);
app.use("/api/payroll", payroll_routes_1.default);
app.use("/api/payslips", payslip_routes_1.default);
app.use("/api/ledger", ledger_routes_1.default);
app.use("/api/scheduler", scheduler_routes_1.default);
app.use("/api/reports", reports_routes_1.default);
app.use("/api/audit-logs", audit_log_routes_1.default);
app.use("/api/settings", settings_routes_1.default);
app.use("/api/dashboard", dashboard_routes_1.default);
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
//# sourceMappingURL=app.js.map