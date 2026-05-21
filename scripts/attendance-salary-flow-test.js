/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const WEEKLY_EMPLOYEE_ID = process.env.WEEKLY_EMPLOYEE_ID;
const MONTHLY_EMPLOYEE_ID = process.env.MONTHLY_EMPLOYEE_ID;

const WEEKLY_PERIOD_START = process.env.WEEKLY_PERIOD_START || "2026-04-27";
const WEEKLY_PERIOD_END = process.env.WEEKLY_PERIOD_END || "2026-05-02";
const MONTHLY_PERIOD_START = process.env.MONTHLY_PERIOD_START || "2026-05-01";
const MONTHLY_PERIOD_END = process.env.MONTHLY_PERIOD_END || "2026-05-31";

let passed = 0;
let failed = 0;
let warned = 0;

function pass(message) {
  passed += 1;
  console.log(`✅ ${message}`);
}

function fail(message, details) {
  failed += 1;
  console.log(`❌ ${message}`);
  if (details !== undefined) console.log(details);
}

function warn(message, details) {
  warned += 1;
  console.log(`⚠️  ${message}`);
  if (details !== undefined) console.log(details);
}

async function request(method, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, ok: response.ok, data };
}

function extractToken(data) {
  return data?.data?.token || data?.token || data?.data?.accessToken || data?.accessToken;
}

async function login(label, phone, password) {
  if (!phone || !password) {
    warn(`${label} login skipped because env credentials are missing`);
    return null;
  }

  const res = await request("POST", "/api/auth/login", {
    body: { phone, password },
  });

  const token = extractToken(res.data);
  if (res.ok && token) {
    pass(`${label} login works`);
    return token;
  }

  fail(`${label} login failed`, { status: res.status, data: res.data });
  return null;
}

function getDataArray(data) {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.records)) return data.data.records;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

function findAttendanceIdsFromBulkResponse(data) {
  const records = data?.data?.records || data?.records || data?.data || [];
  if (!Array.isArray(records)) return [];
  return records.map((item) => item?.id).filter(Boolean);
}

async function testInvalidAttendanceStatus(token) {
  if (!WEEKLY_EMPLOYEE_ID) return;

  const res = await request("POST", "/api/attendance", {
    token,
    body: {
      employeeId: WEEKLY_EMPLOYEE_ID,
      date: WEEKLY_PERIOD_START,
      status: "INVALID_STATUS",
    },
  });

  if (res.status >= 400 && res.status < 500) {
    pass("Invalid attendance status is rejected");
  } else {
    fail("Invalid attendance status should be rejected", { status: res.status, data: res.data });
  }
}

async function createWeeklyCrossMonthAttendance(token) {
  const dates = ["2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01", "2026-05-02"];
  const records = dates.map((date) => ({
    employeeId: WEEKLY_EMPLOYEE_ID,
    date,
    status: "PRESENT",
  }));

  const res = await request("POST", "/api/attendance/bulk", {
    token,
    body: { records },
  });

  if (res.ok) {
    const ids = findAttendanceIdsFromBulkResponse(res.data);
    pass(`Weekly cross-month attendance bulk API responded successfully (${ids.length || "unknown"} records returned)`);
    return ids;
  }

  const message = JSON.stringify(res.data || {}).toLowerCase();
  if (message.includes("already") || message.includes("duplicate") || message.includes("conflict")) {
    warn("Weekly attendance already exists. Continuing with range/preview checks.", { status: res.status, data: res.data });
    return [];
  }

  fail("Weekly cross-month attendance creation failed", { status: res.status, data: res.data });
  return [];
}

async function testDuplicateAttendance(token) {
  const res = await request("POST", "/api/attendance", {
    token,
    body: {
      employeeId: WEEKLY_EMPLOYEE_ID,
      date: WEEKLY_PERIOD_START,
      status: "PRESENT",
    },
  });

  if (res.status >= 400 && res.status < 500) {
    pass("Duplicate attendance is rejected");
  } else {
    fail("Duplicate attendance should be rejected", { status: res.status, data: res.data });
  }
}

async function testAttendanceRange(token) {
  const path = `/api/attendance/employee/${WEEKLY_EMPLOYEE_ID}/range?from=${WEEKLY_PERIOD_START}&to=${WEEKLY_PERIOD_END}&page=1&limit=20`;
  const res = await request("GET", path, { token });

  if (!res.ok) {
    fail("Attendance range fetch failed", { status: res.status, data: res.data });
    return;
  }

  const records = getDataArray(res.data);
  if (records.length >= 6) {
    pass("Attendance range returns cross-month weekly records");
  } else {
    warn("Attendance range responded, but fewer than 6 records were found", { count: records.length, data: res.data });
  }

  if (res.data?.pagination) {
    pass("Attendance range includes pagination metadata");
  } else {
    warn("Attendance range did not include pagination metadata");
  }
}

async function testWeeklySalaryPreview(token) {
  const res = await request("POST", "/api/salary-calculation/preview", {
    token,
    body: {
      employeeId: WEEKLY_EMPLOYEE_ID,
      periodStart: WEEKLY_PERIOD_START,
      periodEnd: WEEKLY_PERIOD_END,
    },
  });

  if (!res.ok) {
    fail("Weekly salary preview failed", { status: res.status, data: res.data });
    return;
  }

  const data = res.data?.data || res.data;
  const salaryType = data?.employee?.salaryType;
  const presentDays = Number(data?.attendanceSummary?.presentDays ?? -1);
  const grossSalary = Number(data?.result?.grossSalary ?? -1);
  const finalSalary = Number(data?.result?.finalSalary ?? -1);

  if (salaryType === "WEEKLY") pass("Weekly salary preview returns salaryType WEEKLY");
  else warn("Weekly salary preview salaryType is not WEEKLY or missing", data?.employee);

  if (presentDays >= 6) pass("Weekly salary preview counts cross-month present days");
  else warn("Weekly salary preview presentDays is lower than expected", data?.attendanceSummary);

  if (grossSalary >= 0 && finalSalary >= 0) pass("Weekly salary preview returns salary result values");
  else fail("Weekly salary preview missing salary result values", data?.result);
}

async function testMissingAttendancePreview(token) {
  if (!MONTHLY_EMPLOYEE_ID) {
    warn("Monthly missing-attendance preview skipped because MONTHLY_EMPLOYEE_ID is missing");
    return;
  }

  const res = await request("POST", "/api/salary-calculation/preview", {
    token,
    body: {
      employeeId: MONTHLY_EMPLOYEE_ID,
      periodStart: MONTHLY_PERIOD_START,
      periodEnd: MONTHLY_PERIOD_END,
    },
  });

  const message = JSON.stringify(res.data || {}).toLowerCase();
  if (res.status >= 400 && message.includes("attendance missing")) {
    pass("Salary preview blocks payroll when attendance is missing");
  } else if (res.ok) {
    warn("Monthly preview succeeded. That is okay only if full monthly attendance already exists.", res.data?.data?.attendanceSummary);
  } else {
    warn("Monthly missing-attendance preview failed with a different error", { status: res.status, data: res.data });
  }
}

async function testAdminCanAccessAttendance(token) {
  if (!token || !WEEKLY_EMPLOYEE_ID) return;
  const res = await request("GET", `/api/attendance/employee/${WEEKLY_EMPLOYEE_ID}/range?from=${WEEKLY_PERIOD_START}&to=${WEEKLY_PERIOD_END}`, { token });

  if (res.status < 500) pass("ADMIN/SUPER_ADMIN can call attendance range without server error");
  else fail("ADMIN/SUPER_ADMIN attendance range returned server error", { status: res.status, data: res.data });
}

async function main() {
  console.log(`Running attendance + salary flow tests against: ${BASE_URL}`);

  if (!WEEKLY_EMPLOYEE_ID) {
    fail("WEEKLY_EMPLOYEE_ID env value is required. Run Step 3 first and copy the WEEKLY_EMPLOYEE_ID output.");
    process.exit(1);
  }

  const superAdminToken = await login("SUPER_ADMIN", SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD);
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const token = superAdminToken || adminToken;

  if (!token) {
    fail("No ADMIN/SUPER_ADMIN token available. Cannot continue.");
    process.exit(1);
  }

  await testInvalidAttendanceStatus(token);
  await createWeeklyCrossMonthAttendance(token);
  await testDuplicateAttendance(token);
  await testAttendanceRange(token);
  await testAdminCanAccessAttendance(token);
  await testWeeklySalaryPreview(token);
  await testMissingAttendancePreview(token);

  console.log("\nStep 4 summary:");
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Attendance + salary flow test crashed:", error);
  process.exit(1);
});
