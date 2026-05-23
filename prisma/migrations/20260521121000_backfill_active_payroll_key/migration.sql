DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        "employeeId",
        "periodStart",
        "periodEnd",
        COUNT(*) AS duplicate_count
      FROM "Payroll"
      WHERE status IN ('GENERATED', 'PAID')
      GROUP BY "employeeId", "periodStart", "periodEnd"
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot backfill activePayrollKey: duplicate active payroll records exist. Resolve duplicates first.';
  END IF;
END $$;

UPDATE "Payroll"
SET "activePayrollKey" =
  "employeeId" || '_' ||
  TO_CHAR("periodStart", 'YYYY-MM-DD') || '_' ||
  TO_CHAR("periodEnd", 'YYYY-MM-DD')
WHERE status IN ('GENERATED', 'PAID')
  AND "activePayrollKey" IS NULL;
