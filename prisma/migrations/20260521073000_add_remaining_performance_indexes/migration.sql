-- Remaining Step 2 performance indexes for list/report/status APIs.

-- AttendanceRequest: user request history and admin approval queues.
CREATE INDEX IF NOT EXISTS "AttendanceRequest_employeeId_status_attendanceDate_idx" ON "AttendanceRequest"("employeeId", "status", "attendanceDate");
CREATE INDEX IF NOT EXISTS "AttendanceRequest_status_attendanceDate_idx" ON "AttendanceRequest"("status", "attendanceDate");
CREATE INDEX IF NOT EXISTS "AttendanceRequest_requestedById_idx" ON "AttendanceRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "AttendanceRequest_approvedById_idx" ON "AttendanceRequest"("approvedById");
CREATE INDEX IF NOT EXISTS "AttendanceRequest_createdAt_idx" ON "AttendanceRequest"("createdAt");

-- PayrollCarryForward: carry-forward deductions and employee pending balances.
CREATE INDEX IF NOT EXISTS "PayrollCarryForward_employeeId_status_idx" ON "PayrollCarryForward"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "PayrollCarryForward_employeeId_status_cycleStartDate_idx" ON "PayrollCarryForward"("employeeId", "status", "cycleStartDate");
CREATE INDEX IF NOT EXISTS "PayrollCarryForward_createdAt_idx" ON "PayrollCarryForward"("createdAt");

-- Payslip: employee history, payroll lookup, and period reports.
CREATE INDEX IF NOT EXISTS "Payslip_employeeId_periodStart_periodEnd_idx" ON "Payslip"("employeeId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "Payslip_periodStart_periodEnd_idx" ON "Payslip"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "Payslip_createdAt_idx" ON "Payslip"("createdAt");

-- LedgerEntry: employee ledger timelines, payroll ledger lookup, and date reports.
CREATE INDEX IF NOT EXISTS "LedgerEntry_employeeId_type_date_idx" ON "LedgerEntry"("employeeId", "type", "date");
CREATE INDEX IF NOT EXISTS "LedgerEntry_payrollId_idx" ON "LedgerEntry"("payrollId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_date_idx" ON "LedgerEntry"("date");
CREATE INDEX IF NOT EXISTS "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- AuditLog: high-volume audit filters by module/action/user/employee/status over time.
CREATE INDEX IF NOT EXISTS "AuditLog_module_createdAt_idx" ON "AuditLog"("module", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_employeeId_createdAt_idx" ON "AuditLog"("employeeId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_status_createdAt_idx" ON "AuditLog"("status", "createdAt");

-- WorkHourSetting: overtime setting lookup by period and active flag.
CREATE INDEX IF NOT EXISTS "WorkHourSetting_effectiveFromDate_isActive_idx" ON "WorkHourSetting"("effectiveFromDate", "isActive");
CREATE INDEX IF NOT EXISTS "WorkHourSetting_createdAt_idx" ON "WorkHourSetting"("createdAt");

-- SchedulerRun: scheduler history, status filters, and latest run lookup.
CREATE INDEX IF NOT EXISTS "SchedulerRun_name_idx" ON "SchedulerRun"("name");
CREATE INDEX IF NOT EXISTS "SchedulerRun_status_createdAt_idx" ON "SchedulerRun"("status", "createdAt");
