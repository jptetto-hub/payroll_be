-- Speed up contains/ILIKE employee searches and employee-scoped payroll lists.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Employee_name_trgm_idx"
ON "Employee" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Employee_employeeCode_trgm_idx"
ON "Employee" USING GIN ("employeeCode" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Employee_phone_trgm_idx"
ON "Employee" USING GIN ("phone" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Employee_email_trgm_idx"
ON "Employee" USING GIN ("email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Employee_department_trgm_idx"
ON "Employee" USING GIN ("department" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Payroll_employeeId_createdAt_desc_idx"
ON "Payroll" ("employeeId", "createdAt" DESC);
