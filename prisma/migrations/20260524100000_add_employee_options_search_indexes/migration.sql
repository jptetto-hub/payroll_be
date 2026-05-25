-- Improve employee options lookup for active employee dropdown/search.
-- Note: contains/ILIKE searches on very large data should later use pg_trgm GIN indexes.
CREATE INDEX IF NOT EXISTS "Employee_status_employeeCode_idx"
ON "Employee" ("status", "employeeCode");

CREATE INDEX IF NOT EXISTS "Employee_status_name_idx"
ON "Employee" ("status", "name");
