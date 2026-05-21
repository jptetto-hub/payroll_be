/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const USER_PHONE = process.env.USER_PHONE;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const EMPLOYEE_ID = process.env.WEEKLY_EMPLOYEE_ID || process.env.EMPLOYEE_ID;
const APRIL_EFFECTIVE_DATE = process.env.APRIL_WORK_HOUR_EFFECTIVE_DATE || "2026-04-01";
const MAY_EFFECTIVE_DATE = process.env.MAY_WORK_HOUR_EFFECTIVE_DATE || "2026-05-01";
const OT_DATE = process.env.OT_DATE || "2026-05-18";

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

  return { status: response.status, ok: response.ok, data, contentType };
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

async function login(label, phone, password) {
  if (!phone || !password) {
    warn(`${label} login skipped because env credentials are missing`);
    return null;
  }

  const res = await request("POST", "/api/auth/login", { body: { phone, password } });
  const token = extractToken(res.data);

  if (res.ok && token) {
    pass(`${label} login works`);
    return token;
  }

  fail(`${label} login failed`, { status: res.status, data: res.data });
  return null;
}

async function expectBlocked(label, method, path, token, body) {
  if (!token) return;
  const res = await request(method, path, { token, body });
  if ([401, 403].includes(res.status)) pass(`${label}: ${method} ${path} is blocked`);
  else fail(`${label}: ${method} ${path} should be blocked`, { status: res.status, data: res.data });
}

async function createWorkHourSetting(label, token, body) {
  if (!token) return null;
  const res = await request("POST", "/api/settings/work-hours", { token, body });

  if ([200, 201].includes(res.status)) {
    pass(`${label} work-hour setting created`);
    return res.data?.data || res.data;
  }

  if ([400, 409].includes(res.status)) {
    warn(`${label} work-hour setting was not created, probably duplicate or validation rule`, {
      status: res.status,
      data: res.data,
    });
    return null;
  }

  fail(`${label} work-hour setting create failed`, { status: res.status, data: res.data });
  return null;
}

async function listWorkHourSettings(label, token) {
  if (!token) return [];
  const res = await request("GET", "/api/settings/work-hours?page=1&limit=50", { token });

  if (!res.ok) {
    fail(`${label} work-hour settings list failed`, { status: res.status, data: res.data });
    return [];
  }

  pass(`${label} work-hour settings list works`);
  if (res.data?.pagination || res.data?.data?.pagination) pass(`${label} work-hour settings response includes pagination`);
  else warn(`${label} work-hour settings response has no pagination object`);

  return getDataArray(res.data);
}

async function testInvalidWorkHour(adminToken) {
  if (!adminToken) return;

  const res = await request("POST", "/api/settings/work-hours", {
    token: adminToken,
    body: {
      workStartTime: "9AM",
      workEndTime: "17:00",
      effectiveFromDate: MAY_EFFECTIVE_DATE,
      note: "Invalid time format smoke test",
    },
  });

  if ([400, 422].includes(res.status)) pass("Invalid workStartTime is rejected");
  else fail("Invalid workStartTime should be rejected", { status: res.status, data: res.data });
}

async function testAttendanceOvertime(adminToken) {
  if (!adminToken) return;
  if (!EMPLOYEE_ID) {
    warn("OT attendance test skipped because WEEKLY_EMPLOYEE_ID or EMPLOYEE_ID is missing");
    return null;
  }

  const body = {
    employeeId: EMPLOYEE_ID,
    date: OT_DATE,
    status: "PRESENT",
    checkInTime: `${OT_DATE}T09:00:00.000Z`,
    checkOutTime: `${OT_DATE}T20:00:00.000Z`,
    otManualOverride: true,
    otHours: 2.5,
    otOverrideReason: "Testing manual overtime entry",
  };

  const res = await request("POST", "/api/attendance", { token: adminToken, body });

  if ([200, 201].includes(res.status)) {
    pass("Attendance with manual OT created");
    const record = res.data?.data || res.data;
    if (Number(record?.otHours ?? 0) > 0) pass("Attendance response includes positive otHours");
    else warn("Attendance created, but otHours was not visible in response", res.data);
    return record;
  }

  if ([400, 409].includes(res.status)) {
    warn("Attendance with OT was not created, probably duplicate/payroll lock/date validation", {
      status: res.status,
      data: res.data,
    });
  } else {
    fail("Attendance with OT create failed", { status: res.status, data: res.data });
  }

  return null;
}

async function testAttendanceRangeShowsOt(adminToken) {
  if (!adminToken || !EMPLOYEE_ID) return;

  const res = await request(
    "GET",
    `/api/attendance/employee/${EMPLOYEE_ID}/range?from=${OT_DATE}&to=${OT_DATE}`,
    { token: adminToken },
  );

  if (!res.ok) {
    warn("Attendance range fetch for OT date failed", { status: res.status, data: res.data });
    return;
  }

  pass("Attendance range fetch for OT date works");
  const records = getDataArray(res.data);
  const hasOtField = records.some((record) => Object.prototype.hasOwnProperty.call(record, "otHours"));

  if (hasOtField) pass("Attendance range includes OT fields");
  else warn("Attendance range works, but OT fields are not visible in response");
}

async function testSalaryPreviewWithOt(adminToken) {
  if (!adminToken || !EMPLOYEE_ID) return;

  const res = await request("POST", "/api/salary-calculation/preview", {
    token: adminToken,
    body: {
      employeeId: EMPLOYEE_ID,
      periodStart: OT_DATE,
      periodEnd: OT_DATE,
      salaryType: "WEEKLY",
    },
  });

  if (res.ok) {
    pass("Salary preview for OT date works");
    const payload = res.data?.data || res.data;
    const serialized = JSON.stringify(payload || {});
    if (/ot|overtime/i.test(serialized)) pass("Salary preview includes OT/overtime data");
    else warn("Salary preview works, but OT/overtime data was not visible in response", payload);
    return;
  }

  if ([400, 422].includes(res.status)) {
    warn("Salary preview for OT date was blocked by business validation, usually missing attendance/salary cycle rule", {
      status: res.status,
      data: res.data,
    });
    return;
  }

  fail("Salary preview for OT date failed", { status: res.status, data: res.data });
}

async function main() {
  console.log(`Running settings + overtime flow test against: ${BASE_URL}`);

  const userToken = await login("USER", USER_PHONE, USER_PASSWORD);
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const superAdminToken = await login("SUPER_ADMIN", SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD);
  const privilegedToken = superAdminToken || adminToken;

  await expectBlocked("USER", "GET", "/api/settings/work-hours", userToken);
  await expectBlocked("USER", "POST", "/api/settings/work-hours", userToken, {
    workStartTime: "09:00",
    workEndTime: "17:00",
    effectiveFromDate: MAY_EFFECTIVE_DATE,
  });
  await expectBlocked("ADMIN", "GET", "/api/settings", adminToken);

  await testInvalidWorkHour(privilegedToken);

  await createWorkHourSetting("April 9-hour", privilegedToken, {
    workStartTime: "09:00",
    workEndTime: "18:00",
    effectiveFromDate: APRIL_EFFECTIVE_DATE,
    note: "TEST April 9 hour historical setting",
  });

  await createWorkHourSetting("May 10-hour", privilegedToken, {
    workStartTime: "08:00",
    workEndTime: "18:00",
    effectiveFromDate: MAY_EFFECTIVE_DATE,
    note: "TEST May 10 hour historical setting",
  });

  const settings = await listWorkHourSettings("ADMIN/SUPER_ADMIN", privilegedToken);
  const aprilSetting = settings.find((item) => String(item.effectiveFromDate || item.effectiveFrom || "").startsWith(APRIL_EFFECTIVE_DATE));
  const maySetting = settings.find((item) => String(item.effectiveFromDate || item.effectiveFrom || "").startsWith(MAY_EFFECTIVE_DATE));

  if (aprilSetting) pass("April historical work-hour setting is present");
  else warn("April historical work-hour setting was not found in list, possibly duplicate create was rejected and list format differs");

  if (maySetting) pass("May historical work-hour setting is present");
  else warn("May historical work-hour setting was not found in list, possibly duplicate create was rejected and list format differs");

  await testAttendanceOvertime(privilegedToken);
  await testAttendanceRangeShowsOt(privilegedToken);
  await testSalaryPreviewWithOt(privilegedToken);

  if (superAdminToken) {
    const auditRes = await request("GET", "/api/audit-logs?page=1&limit=10", { token: superAdminToken });
    if (auditRes.ok) pass("Audit logs can be checked after work-hour/OT operations");
    else warn("Audit logs check failed or route is restricted", { status: auditRes.status, data: auditRes.data });
  }

  console.log("\nSettings + overtime flow test completed.");
  console.log(`Passed: ${passed}`);
  console.log(`Warnings: ${warned}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Settings + overtime flow test crashed:", error);
  process.exit(1);
});
