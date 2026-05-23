-- Minimum performance indexes for payroll generation and scheduler throughput.

-- Employee: active employee batching and common filters/search.
CREATE INDEX IF NOT EXISTS "Employee_status_role_idx" ON "Employee"("status", "role");
CREATE INDEX IF NOT EXISTS "Employee_status_salaryType_idx" ON "Employee"("status", "salaryType");
CREATE INDEX IF NOT EXISTS "Employee_name_idx" ON "Employee"("name");
CREATE INDEX IF NOT EXISTS "Employee_createdAt_idx" ON "Employee"("createdAt");

-- SalaryHistory: first/latest salary lookup per employee.
CREATE INDEX IF NOT EXISTS "SalaryHistory_employeeId_effectiveFrom_desc_idx" ON "SalaryHistory"("employeeId", "effectiveFrom" DESC);
CREATE INDEX IF NOT EXISTS "SalaryHistory_createdAt_idx" ON "SalaryHistory"("createdAt");

-- Attendance: payroll period range reads and attendance summaries.
CREATE INDEX IF NOT EXISTS "Attendance_employeeId_date_status_idx" ON "Attendance"("employeeId", "date", "status");
CREATE INDEX IF NOT EXISTS "Attendance_date_status_idx" ON "Attendance"("date", "status");
CREATE INDEX IF NOT EXISTS "Attendance_createdAt_idx" ON "Attendance"("createdAt");

-- AdvancePayment: advance deduction and unsettled advance lookups.
CREATE INDEX IF NOT EXISTS "AdvancePayment_employeeId_payCycleType_cycleStartDate_cycleEndDate_idx" ON "AdvancePayment"("employeeId", "payCycleType", "cycleStartDate", "cycleEndDate");
CREATE INDEX IF NOT EXISTS "AdvancePayment_employeeId_settlementStatus_cycleStartDate_idx" ON "AdvancePayment"("employeeId", "settlementStatus", "cycleStartDate");
CREATE INDEX IF NOT EXISTS "AdvancePayment_employeeId_isSettled_idx" ON "AdvancePayment"("employeeId", "isSettled");
CREATE INDEX IF NOT EXISTS "AdvancePayment_createdAt_idx" ON "AdvancePayment"("createdAt");

-- Payroll: duplicate checks, latest payroll lookup, period reports, and scheduler skips.
CREATE INDEX IF NOT EXISTS "Payroll_employeeId_status_periodEnd_idx" ON "Payroll"("employeeId", "status", "periodEnd");
CREATE INDEX IF NOT EXISTS "Payroll_employeeId_status_periodStart_periodEnd_idx" ON "Payroll"("employeeId", "status", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "Payroll_periodStart_periodEnd_status_idx" ON "Payroll"("periodStart", "periodEnd", "status");
CREATE INDEX IF NOT EXISTS "Payroll_salaryType_periodStart_periodEnd_idx" ON "Payroll"("salaryType", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "Payroll_replacedPayrollId_idx" ON "Payroll"("replacedPayrollId");
CREATE INDEX IF NOT EXISTS "Payroll_createdAt_idx" ON "Payroll"("createdAt");
