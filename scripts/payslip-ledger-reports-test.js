/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const USER_PHONE = process.env.USER_PHONE;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const WEEKLY_EMPLOYEE_ID = process.env.WEEKLY_EMPLOYEE_ID;
const WEEKLY_PAYROLL_ID = process.env.WEEKLY_PAYROLL_ID;
const FROM_DATE = process.env.REPORT_FROM_DATE || process.env.WEEKLY_PERIOD_START || "2026-04-27";
const TO_DATE = process.env.REPORT_TO_DATE || process.env.WEEKLY_PERIOD_END || "2026-05-02";

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
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    contentType,
    headers: response.headers,
  };
}

function extractToken(data) {
  return data?.data?.token || data?.token || data?.data?.accessToken || data?.accessToken;
}

function getDataArray(data) {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.records)) return data.data.records;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

function hasPagination(data) {
  return Boolean(data?.pagination || data?.data?.pagination);
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

async function expectBlocked(label, method, path, token) {
  if (!token) return;
  const res = await request(method, path, { token });
  if ([401, 403].includes(res.status)) pass(`${label}: ${method} ${path} is blocked`);
  else fail(`${label}: ${method} ${path} should be blocked`, { status: res.status, data: res.data });
}

async function expectOkOrWarn(label, method, path, token, validate) {
  if (!token) return null;
  const res = await request(method, path, { token });

  if (res.ok) {
    pass(label);
    if (validate) validate(res);
    return res;
  }

  if (res.status === 404) {
    warn(`${label} returned 404. Data or endpoint may not exist for this DB state.`, res.data);
    return res;
  }

  fail(`${label} failed`, { status: res.status, data: res.data });
  return res;
}

async function testPayslips(adminToken, userToken) {
  console.log("\n--- Payslip Tests ---");

  await expectOkOrWarn("ADMIN payslip list works", "GET", "/api/payslips?page=1&limit=10", adminToken, (res) => {
    if (hasPagination(res.data)) pass("Payslip list includes pagination");
    else warn("Payslip list pagination not found in response", res.data);
  });

  if (userToken) {
    await expectOkOrWarn("USER my payslips works", "GET", "/api/payslips/my?page=1&limit=10", userToken, (res) => {
      if (hasPagination(res.data)) pass("USER my payslips includes pagination");
      else warn("USER my payslips pagination not found", res.data);
    });
  }

  if (WEEKLY_EMPLOYEE_ID) {
    await expectOkOrWarn(
      "ADMIN payslips by employee works",
      "GET",
      `/api/payslips/employee/${WEEKLY_EMPLOYEE_ID}?page=1&limit=10`,
      adminToken,
    );
    await expectBlocked("USER", "GET", `/api/payslips/employee/${WEEKLY_EMPLOYEE_ID}`, userToken);
  } else {
    warn("WEEKLY_EMPLOYEE_ID missing, skipped payslips by employee test");
  }

  if (WEEKLY_PAYROLL_ID) {
    await expectOkOrWarn(
      "ADMIN payslip by payroll works",
      "GET",
      `/api/payslips/payroll/${WEEKLY_PAYROLL_ID}`,
      adminToken,
      (res) => {
        const data = res.data?.data || res.data;
        if (data?.payrollId || data?.payroll?.id || data?.id) pass("Payslip by payroll returns payslip-like data");
        else warn("Payslip by payroll response shape could not be verified", res.data);
      },
    );
    await expectBlocked("USER", "GET", `/api/payslips/payroll/${WEEKLY_PAYROLL_ID}`, userToken);
  } else {
    warn("WEEKLY_PAYROLL_ID missing, skipped payslip by payroll test");
  }
}

async function testLedger(adminToken, userToken) {
  console.log("\n--- Ledger Tests ---");

  await expectOkOrWarn("ADMIN ledger list works", "GET", "/api/ledger?page=1&limit=10", adminToken, (res) => {
    if (hasPagination(res.data)) pass("Ledger list includes pagination");
    else warn("Ledger list pagination not found in response", res.data);
  });

  if (userToken) {
    await expectOkOrWarn("USER my ledger works", "GET", "/api/ledger/my?page=1&limit=10", userToken, (res) => {
      if (hasPagination(res.data)) pass("USER my ledger includes pagination");
      else warn("USER my ledger pagination not found", res.data);
    });
  }

  if (WEEKLY_EMPLOYEE_ID) {
    await expectOkOrWarn(
      "ADMIN employee ledger works",
      "GET",
      `/api/ledger/employee/${WEEKLY_EMPLOYEE_ID}?page=1&limit=10`,
      adminToken,
    );
    await expectBlocked("USER", "GET", `/api/ledger/employee/${WEEKLY_EMPLOYEE_ID}`, userToken);
  } else {
    warn("WEEKLY_EMPLOYEE_ID missing, skipped employee ledger test");
  }

  if (WEEKLY_PAYROLL_ID) {
    await expectOkOrWarn(
      "ADMIN payroll ledger works",
      "GET",
      `/api/ledger/payroll/${WEEKLY_PAYROLL_ID}?page=1&limit=10`,
      adminToken,
      (res) => {
        const rows = getDataArray(res.data);
        if (rows.length > 0) pass("Payroll ledger has at least one entry");
        else warn("Payroll ledger returned empty list", res.data);
      },
    );
    await expectBlocked("USER", "GET", `/api/ledger/payroll/${WEEKLY_PAYROLL_ID}`, userToken);
  } else {
    warn("WEEKLY_PAYROLL_ID missing, skipped payroll ledger test");
  }
}

async function testReports(adminToken, userToken) {
  console.log("\n--- Reports Tests ---");

  const employeeQuery = WEEKLY_EMPLOYEE_ID ? `&employeeId=${WEEKLY_EMPLOYEE_ID}` : "";
  const query = `?from=${FROM_DATE}&to=${TO_DATE}&page=1&limit=10${employeeQuery}`;

  const reportRoutes = [
    ["Salary report", `/api/reports/salary${query}`],
    ["Attendance report", `/api/reports/attendance${query}`],
    ["Advance report", `/api/reports/advance${query}`],
    ["All-in-one report", `/api/reports/all-in-one${query}`],
  ];

  for (const [label, path] of reportRoutes) {
    await expectOkOrWarn(`ADMIN ${label} works`, "GET", path, adminToken, (res) => {
      if (hasPagination(res.data)) pass(`${label} includes pagination`);
      else warn(`${label} pagination not found`, res.data);
    });
    await expectOkOrWarn(`USER ${label} works`, "GET", path, userToken);
  }

  const exportRoutes = [
    ["Salary CSV export", `/api/reports/salary/export${query}`, "text/csv"],
    ["Attendance CSV export", `/api/reports/attendance/export${query}`, "text/csv"],
    ["Advance CSV export", `/api/reports/advance/export${query}`, "text/csv"],
    ["All-in-one CSV export", `/api/reports/all-in-one/export${query}`, "text/csv"],
    ["Salary Excel export", `/api/reports/salary/export/excel${query}`, "spreadsheetml"],
    ["Attendance Excel export", `/api/reports/attendance/export/excel${query}`, "spreadsheetml"],
    ["Advance Excel export", `/api/reports/advance/export/excel${query}`, "spreadsheetml"],
    ["All-in-one Excel export", `/api/reports/all-in-one/export/excel${query}`, "spreadsheetml"],
  ];

  for (const [label, path, expectedContentType] of exportRoutes) {
    await expectBlocked("USER", "GET", path, userToken);
    await expectOkOrWarn(`ADMIN ${label} works`, "GET", path, adminToken, (res) => {
      if (res.contentType.includes(expectedContentType)) pass(`${label} content type is correct`);
      else warn(`${label} content type could not be verified`, res.contentType);
    });
  }
}

async function testAuditLogs(adminToken, superAdminToken, userToken) {
  console.log("\n--- Audit Log Tests ---");

  await expectBlocked("USER", "GET", "/api/audit-logs?page=1&limit=10", userToken);

  const auditToken = superAdminToken || adminToken;
  await expectOkOrWarn("ADMIN/SUPER_ADMIN audit log list works", "GET", "/api/audit-logs?page=1&limit=10", auditToken, (res) => {
    if (hasPagination(res.data)) pass("Audit log list includes pagination");
    else warn("Audit log list pagination not found", res.data);
  });

  await expectOkOrWarn("ADMIN/SUPER_ADMIN audit log export works", "GET", "/api/audit-logs/export", auditToken, (res) => {
    if (res.contentType.includes("text/csv") || typeof res.data === "string") pass("Audit export returns downloadable/text data");
    else warn("Audit export content type could not be verified", res.contentType);
  });
}

async function main() {
  console.log(`Running payslip/ledger/reports tests against: ${BASE_URL}`);
  console.log(`Date range: ${FROM_DATE} to ${TO_DATE}`);

  const userToken = await login("USER", USER_PHONE, USER_PASSWORD);
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const superAdminToken = await login("SUPER_ADMIN", SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD);
  const privilegedToken = adminToken || superAdminToken;

  if (!privilegedToken) {
    fail("No ADMIN or SUPER_ADMIN token available. Cannot continue.");
    process.exit(1);
  }

  await testPayslips(privilegedToken, userToken);
  await testLedger(privilegedToken, userToken);
  await testReports(privilegedToken, userToken);
  await testAuditLogs(adminToken, superAdminToken, userToken);

  console.log("\n--- Step 7 Summary ---");
  console.log(`Passed: ${passed}`);
  console.log(`Warnings: ${warned}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Step 7 test crashed:", error);
  process.exit(1);
});
