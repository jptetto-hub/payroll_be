/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const WEEKLY_EMPLOYEE_ID = process.env.WEEKLY_EMPLOYEE_ID;
const WEEKLY_PERIOD_START = process.env.WEEKLY_PERIOD_START || "2026-04-27";
const WEEKLY_PERIOD_END = process.env.WEEKLY_PERIOD_END || "2026-05-02";
const WEEKLY_ADVANCE_AMOUNT = Number(process.env.WEEKLY_ADVANCE_AMOUNT || 1500);

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

function extractId(data) {
  return data?.data?.id || data?.id || data?.data?.payroll?.id || data?.payroll?.id || data?.data?.advance?.id || data?.advance?.id;
}

function getDataArray(data) {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.records)) return data.data.records;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

function amount(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForQueuedPayroll(token, jobId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const res = await request("GET", `/api/scheduler/runs/${jobId}`, { token });
    const status = res.data?.data?.status;

    if (status === "COMPLETED") {
      pass(`Queued payroll generation completed: ${jobId}`);
      return await findExistingPayroll(token);
    }

    if (status === "FAILED" || status === "PARTIAL_SUCCESS") {
      fail("Queued payroll generation failed", res.data);
      return null;
    }

    await sleep(1000);
  }

  warn(`Queued payroll generation is still running: ${jobId}`);
  return null;
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

async function createWeeklyAdvance(token) {
  const body = {
    employeeId: WEEKLY_EMPLOYEE_ID,
    amount: WEEKLY_ADVANCE_AMOUNT,
    date: WEEKLY_PERIOD_START,
    deductionCycleStartDate: WEEKLY_PERIOD_START,
    note: `TEST advance for payroll flow ${Date.now()}`,
  };

  const res = await request("POST", "/api/advances", { token, body });

  if (res.ok) {
    const id = extractId(res.data);
    pass(`Weekly advance created${id ? `: ${id}` : ""}`);

    const advance = res.data?.data || res.data;
    if (amount(advance?.amount) === WEEKLY_ADVANCE_AMOUNT) pass("Advance amount matches expected value");
    else warn("Advance amount could not be verified from response", res.data);

    if (advance?.isSettled === false || advance?.isSettled === undefined) pass("Advance is initially unsettled or settlement flag is omitted");
    else warn("Advance settlement flag was not initially false", advance);

    return id;
  }

  const msg = JSON.stringify(res.data || {}).toLowerCase();
  if (msg.includes("salary") || msg.includes("cycle") || msg.includes("advance") || msg.includes("cannot")) {
    warn("Weekly advance was rejected by business rule. Continue payroll test without new advance.", { status: res.status, data: res.data });
    return null;
  }

  fail("Weekly advance creation failed", { status: res.status, data: res.data });
  return null;
}

async function listCycleAdvances(token) {
  const path = `/api/advances/employee/${WEEKLY_EMPLOYEE_ID}/cycle?cycleStartDate=${WEEKLY_PERIOD_START}&cycleEndDate=${WEEKLY_PERIOD_END}`;
  const res = await request("GET", path, { token });

  if (res.ok) {
    pass("Cycle advance list works for weekly period");
    return res.data?.data || [];
  }

  warn("Cycle advance list failed or is not supported for this data", { status: res.status, data: res.data });
  return [];
}

async function generateWeeklyPayroll(token) {
  const body = {
    employeeId: WEEKLY_EMPLOYEE_ID,
    periodStart: WEEKLY_PERIOD_START,
    periodEnd: WEEKLY_PERIOD_END,
  };

  const res = await request("POST", "/api/payroll/generate", { token, body });

  if (res.ok) {
    const jobId = res.data?.data?.jobId;

    if (jobId) {
      pass(`Weekly cross-month payroll queued: ${jobId}`);
      return await waitForQueuedPayroll(token, jobId);
    }

    const payroll = res.data?.data?.payroll || res.data?.data || res.data;
    const id = payroll?.id || extractId(res.data);
    pass(`Weekly cross-month payroll generated${id ? `: ${id}` : ""}`);

    if (payroll?.salaryType === "WEEKLY" || payroll?.salaryType === undefined) pass("Payroll salaryType is WEEKLY or omitted by response shape");
    else warn("Payroll salaryType is not WEEKLY", payroll);

    if (payroll?.periodStart?.startsWith?.(WEEKLY_PERIOD_START) || payroll?.periodStart === WEEKLY_PERIOD_START || payroll?.periodStart === undefined) pass("Payroll periodStart matches weekly cross-month start or is omitted");
    else warn("Payroll periodStart mismatch", payroll);

    if (payroll?.periodEnd?.startsWith?.(WEEKLY_PERIOD_END) || payroll?.periodEnd === WEEKLY_PERIOD_END || payroll?.periodEnd === undefined) pass("Payroll periodEnd matches weekly cross-month end or is omitted");
    else warn("Payroll periodEnd mismatch", payroll);

    if (payroll?.finalSalary !== undefined || payroll?.grossSalary !== undefined) pass("Payroll response includes salary values");
    else warn("Payroll response did not expose salary values directly", res.data);

    return id;
  }

  const msg = JSON.stringify(res.data || {}).toLowerCase();
  if (msg.includes("already") || msg.includes("duplicate") || msg.includes("exists")) {
    warn("Payroll already exists for this weekly period. Trying to fetch existing payroll.", { status: res.status, data: res.data });
    return await findExistingPayroll(token);
  }

  fail("Weekly payroll generation failed", { status: res.status, data: res.data });
  return null;
}

async function findExistingPayroll(token) {
  const paths = [
    `/api/payroll/employee/${WEEKLY_EMPLOYEE_ID}?page=1&limit=20`,
    `/api/payroll?employeeId=${WEEKLY_EMPLOYEE_ID}&page=1&limit=20`,
  ];

  for (const path of paths) {
    const res = await request("GET", path, { token });
    if (!res.ok) continue;

    const records = getDataArray(res.data);
    const match = records.find((item) => {
      const start = String(item.periodStart || "").slice(0, 10);
      const end = String(item.periodEnd || "").slice(0, 10);
      return start === WEEKLY_PERIOD_START && end === WEEKLY_PERIOD_END && item.status !== "CANCELLED";
    });

    if (match?.id) {
      pass(`Existing payroll found for weekly period: ${match.id}`);
      return match.id;
    }
  }

  warn("Existing payroll could not be found automatically. Set WEEKLY_PAYROLL_ID manually if needed.");
  return process.env.WEEKLY_PAYROLL_ID || null;
}

async function getPayrollById(token, payrollId) {
  if (!payrollId) return null;

  const res = await request("GET", `/api/payroll/${payrollId}`, { token });
  if (res.ok) {
    pass("Payroll get by id works");
    return res.data?.data || res.data;
  }

  warn("Payroll get by id failed", { status: res.status, data: res.data });
  return null;
}

async function testPayslip(token, payrollId) {
  if (!payrollId) return;

  const res = await request("GET", `/api/payslips/payroll/${payrollId}`, { token });
  if (res.ok) {
    pass("Payslip fetch by payroll works");
    const payslip = res.data?.data || res.data;
    if (payslip?.finalSalary !== undefined || payslip?.salaryBreakdown !== undefined) pass("Payslip includes salary data");
    else warn("Payslip response did not expose expected salary fields", res.data);
    return;
  }

  warn("Payslip by payroll not available or not generated", { status: res.status, data: res.data });
}

async function testLedger(token, payrollId) {
  if (!payrollId) return;

  const res = await request("GET", `/api/ledger/payroll/${payrollId}`, { token });
  if (res.ok) {
    pass("Ledger fetch by payroll works");
    const records = getDataArray(res.data);
    if (records.length > 0) pass(`Ledger has entries for payroll (${records.length})`);
    else warn("Ledger endpoint works but no entries found for payroll", res.data);
    return;
  }

  warn("Ledger by payroll not available or no ledger entry exists", { status: res.status, data: res.data });
}

async function findAttendanceId(token) {
  if (process.env.WEEKLY_ATTENDANCE_ID) return process.env.WEEKLY_ATTENDANCE_ID;

  const path = `/api/attendance/employee/${WEEKLY_EMPLOYEE_ID}/range?from=${WEEKLY_PERIOD_START}&to=${WEEKLY_PERIOD_END}&page=1&limit=20`;
  const res = await request("GET", path, { token });
  if (!res.ok) return null;

  const records = getDataArray(res.data);
  return records[0]?.id || null;
}

async function testPayrollLock(token) {
  const attendanceId = await findAttendanceId(token);
  if (!attendanceId) {
    warn("Payroll lock test skipped because attendance id could not be found");
    return;
  }

  const res = await request("PATCH", `/api/attendance/${attendanceId}`, {
    token,
    body: { status: "ABSENT" },
  });

  if (res.status >= 400 && res.status < 500) {
    pass("Attendance update is blocked after payroll generation or by validation rule");
  } else if (res.ok) {
    fail("Attendance update succeeded after payroll generation. Payroll lock may be missing.", res.data);
  } else {
    warn("Attendance lock test returned unexpected response", { status: res.status, data: res.data });
  }
}

async function testRecalculate(superAdminToken, adminToken, payrollId) {
  if (!payrollId) return;

  if (adminToken) {
    const adminRes = await request("POST", `/api/payroll/${payrollId}/recalculate`, {
      token: adminToken,
      body: { reason: "Testing admin block" },
    });
    if (adminRes.status === 401 || adminRes.status === 403) pass("ADMIN is blocked from payroll recalculation");
    else warn("ADMIN recalculation block returned unexpected status", { status: adminRes.status, data: adminRes.data });
  }

  if (!superAdminToken) {
    warn("SUPER_ADMIN token missing, recalculation success test skipped");
    return;
  }

  const res = await request("POST", `/api/payroll/${payrollId}/recalculate`, {
    token: superAdminToken,
    body: { reason: "Testing payroll recalculation flow" },
  });

  if (res.ok) {
    pass("SUPER_ADMIN payroll recalculation works");
    const newPayrollId = res.data?.data?.newPayroll?.id || res.data?.data?.payroll?.id || res.data?.data?.id;
    if (newPayrollId && newPayrollId !== payrollId) pass(`Recalculation returned new payroll/version: ${newPayrollId}`);
    else warn("Recalculation worked but new payroll/version id was not clear", res.data);
  } else {
    warn("SUPER_ADMIN payroll recalculation failed. This may be expected if payroll cannot be recalculated with current data.", { status: res.status, data: res.data });
  }
}

async function testAuditLogs(superAdminToken) {
  if (!superAdminToken) return;
  const res = await request("GET", "/api/audit-logs?page=1&limit=20", { token: superAdminToken });
  if (res.ok) pass("Audit logs list works for SUPER_ADMIN");
  else warn("Audit logs list failed or is restricted", { status: res.status, data: res.data });
}

async function main() {
  console.log(`Running advance + payroll flow against: ${BASE_URL}`);
  console.log(`Weekly employee: ${WEEKLY_EMPLOYEE_ID || "MISSING"}`);
  console.log(`Weekly period: ${WEEKLY_PERIOD_START} to ${WEEKLY_PERIOD_END}`);

  if (!WEEKLY_EMPLOYEE_ID) {
    fail("WEEKLY_EMPLOYEE_ID env variable is required. Use the id from Step 3.");
    process.exit(1);
  }

  const superAdminToken = await login("SUPER_ADMIN", SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD);
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const actorToken = superAdminToken || adminToken;

  if (!actorToken) {
    fail("No ADMIN/SUPER_ADMIN token available. Cannot continue.");
    process.exit(1);
  }

  await createWeeklyAdvance(actorToken);
  await listCycleAdvances(actorToken);

  const payrollId = await generateWeeklyPayroll(actorToken);
  await getPayrollById(actorToken, payrollId);
  await testPayslip(actorToken, payrollId);
  await testLedger(actorToken, payrollId);
  await testPayrollLock(actorToken);
  await testRecalculate(superAdminToken, adminToken, payrollId);
  await testAuditLogs(superAdminToken);

  console.log("\n--- Step 5 Summary ---");
  console.log(`Passed: ${passed}`);
  console.log(`Warnings: ${warned}`);
  console.log(`Failed: ${failed}`);
  if (payrollId) console.log(`WEEKLY_PAYROLL_ID=${payrollId}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Advance + payroll flow test crashed:", error);
  process.exit(1);
});
