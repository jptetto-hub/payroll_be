import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { errorMiddleware } from "./middlewares/error.middleware";
import { auditContextMiddleware } from "./middlewares/audit-context.middleware";
import authRoutes from "./modules/auth/auth.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import salaryHistoryRoutes from "./modules/salary-history/salary-history.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import attendanceRequestRoutes from "./modules/attendance-requests/attendance-request.routes";
import advanceRoutes from "./modules/advances/advance.routes";
import salaryCalculationRoutes from "./modules/salary-calculation/salary-calculation.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import payslipRoutes from "./modules/payslips/payslip.routes";
import ledgerRoutes from "./modules/ledger/ledger.routes";
import schedulerRoutes from "./modules/scheduler/scheduler.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import auditLogRoutes from "./modules/audit-logs/audit-log.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

const app = express();

app.set("trust proxy", true);

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(auditContextMiddleware);

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Payroll Attendance API running",
  });
});

app.use("/api/auth", authRoutes);

app.use("/api/employees", employeeRoutes);

app.use("/api/salary-history", salaryHistoryRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/attendance-requests", attendanceRequestRoutes);

app.use("/api/advances", advanceRoutes);

app.use("/api/salary-calculation", salaryCalculationRoutes);

app.use("/api/payroll", payrollRoutes);

app.use("/api/payslips", payslipRoutes);

app.use("/api/ledger", ledgerRoutes);

app.use("/api/scheduler", schedulerRoutes);

app.use("/api/reports", reportsRoutes);

app.use("/api/audit-logs", auditLogRoutes);

app.use("/api/settings", settingsRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    errors: [],
  });
});

app.use(errorMiddleware);

export default app;
