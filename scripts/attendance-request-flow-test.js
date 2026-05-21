/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const USER_PHONE = process.env.USER_PHONE;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const REQUEST_ADD_DATE = process.env.REQUEST_ADD_DATE || "2026-05-18";
const REQUEST_REJECT_DATE = process.env.REQUEST_REJECT_DATE || "2026-05-19";
const REQUEST_EDIT_DATE = process.env.REQUEST_EDIT_DATE || REQUEST_ADD_DATE;

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
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
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

function extractEmployee(data) {
  return data?.data?.employee || data?.employee || data?.data || null;
}

function extractCreatedRequests(data) {
  const value = data?.data || data;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.requests)) return value.requests;
  if (Array.isArray(value?.createdRequests)) return value.createdRequests;
  if (Array.isArray(value?.created)) return value.created;
  if (value?.id) return [value];
  return [];
}

function extractPendingRequests(data) {
  const value = data?.data || data;
  if (Array.isArray(value?.requests)) return value.requests;
  if (Array.isArray(value)) return value;
  return [];
}

function findRequestId(data, fallbackArray = []) {
  const created = extractCreatedRequests(data);
  const fromCreated = created.find((item) => item?.id)?.id;
  if (fromCreated) return fromCreated;
  const fromFallback = fallbackArray.find((item) => item?.id)?.id;
  return fromFallback || null;
}

async function login(label, phone, password) {
  if (!phone || !password) {
    warn(`${label} login skipped because env credentials are missing`);
    return { token: null, employee: null };
  }

  const res = await request("POST", "/api/auth/login", {
    body: { phone, password },
  });

  const token = extractToken(res.data);
  const employee = extractEmployee(res.data);

  if (res.ok && token) {
    pass(`${label} login works`);
    return { token, employee };
  }

  fail(`${label} login failed`, { status: res.status, data: res.data });
  return { token: null, employee: null };
}

async function testAuthBlocks() {
  const noToken = await request("GET", "/api/attendance-requests/my");
  if (noToken.status === 401 || noToken.status === 403) pass("Attendance request /my blocks missing token");
  else fail("Attendance request /my should block missing token", { status: noToken.status, data: noToken.data });

  const invalid = await request("GET", "/api/attendance-requests/my", { token: "bad.token.value" });
  if (invalid.status === 401 || invalid.status === 403) pass("Attendance request /my blocks invalid token");
  else fail("Attendance request /my should block invalid token", { status: invalid.status, data: invalid.data });
}

async function testRoleBlocks(userToken, adminToken) {
  if (adminToken) {
    const adminCreate = await request("POST", "/api/attendance-requests", {
      token: adminToken,
      body: {
        requests: [
          {
            attendanceDate: REQUEST_ADD_DATE,
            requestedStatus: "PRESENT",
            requestType: "ADD",
            reason: "Admin should not create user attendance request",
          },
        ],
      },
    });

    if (adminCreate.status === 401 || adminCreate.status === 403) pass("ADMIN is blocked from creating USER attendance request");
    else warn("ADMIN create request was not blocked by route; service may still reject it", { status: adminCreate.status, data: adminCreate.data });
  }

  if (userToken) {
    const userApprove = await request("PATCH", "/api/attendance-requests/00000000-0000-0000-0000-000000000000/approve", {
      token: userToken,
    });

    if (userApprove.status === 401 || userApprove.status === 403) pass("USER is blocked from approving attendance request");
    else fail("USER should be blocked from approving attendance request", { status: userApprove.status, data: userApprove.data });
  }
}

async function testInvalidCreate(userToken) {
  if (!userToken) return;

  const res = await request("POST", "/api/attendance-requests", {
    token: userToken,
    body: {
      requests: [
        {
          attendanceDate: REQUEST_ADD_DATE,
          requestedStatus: "WRONG_STATUS",
          requestType: "ADD",
          reason: "Bad status test",
        },
      ],
    },
  });

  if (res.status >= 400 && res.status < 500) pass("Invalid requestedStatus is rejected");
  else fail("Invalid requestedStatus should be rejected", { status: res.status, data: res.data });
}

async function createAddRequest(userToken, date, status, reason) {
  const res = await request("POST", "/api/attendance-requests", {
    token: userToken,
    body: {
      requests: [
        {
          attendanceDate: date,
          requestedStatus: status,
          requestType: "ADD",
          reason,
        },
      ],
    },
  });

  if (res.ok) {
    const id = findRequestId(res.data);
    pass(`USER created ADD attendance request for ${date}${id ? `: ${id}` : ""}`);
    return { id, data: res.data };
  }

  const msg = JSON.stringify(res.data || {}).toLowerCase();
  if (msg.includes("already exists") || msg.includes("attendance already") || msg.includes("future") || msg.includes("joining date") || msg.includes("locked")) {
    warn(`Could not create ADD request for ${date} due to current business/data state`, { status: res.status, data: res.data });
    return { id: null, data: res.data };
  }

  fail(`USER ADD attendance request failed for ${date}`, { status: res.status, data: res.data });
  return { id: null, data: res.data };
}

async function testDuplicatePending(userToken) {
  if (!userToken) return;

  const res = await request("POST", "/api/attendance-requests", {
    token: userToken,
    body: {
      requests: [
        {
          attendanceDate: REQUEST_ADD_DATE,
          requestedStatus: "PRESENT",
          requestType: "ADD",
          reason: "Duplicate pending request test",
        },
      ],
    },
  });

  if (res.status >= 400 && res.status < 500) pass("Duplicate pending attendance request is rejected or existing attendance prevents duplicate");
  else warn("Duplicate request was accepted; check if previous request was not created", { status: res.status, data: res.data });
}

async function testMyRequests(userToken) {
  if (!userToken) return [];

  const path = `/api/attendance-requests/my?from=${REQUEST_ADD_DATE}&to=${REQUEST_REJECT_DATE}&page=1&limit=20`;
  const res = await request("GET", path, { token: userToken });

  if (!res.ok) {
    fail("USER /attendance-requests/my failed", { status: res.status, data: res.data });
    return [];
  }

  pass("USER /attendance-requests/my works with date range");

  const data = res.data?.data || {};
  if (data.overallCount && data.rangeCount) pass("/my response includes overallCount and rangeCount");
  else warn("/my response missing expected overallCount/rangeCount", res.data);

  if (Array.isArray(data.pending) && Array.isArray(data.approved) && Array.isArray(data.rejected)) pass("/my response is grouped into pending/approved/rejected arrays");
  else warn("/my response grouping could not be verified", res.data);

  return [...(data.pending || []), ...(data.approved || []), ...(data.rejected || [])];
}

async function testPendingRequests(token, label, employeeId) {
  if (!token) return [];

  const queryEmployee = employeeId ? `&employeeId=${employeeId}` : "";
  const path = `/api/attendance-requests/pending?from=${REQUEST_ADD_DATE}&to=${REQUEST_REJECT_DATE}${queryEmployee}&page=1&limit=20`;
  const res = await request("GET", path, { token });

  if (!res.ok) {
    fail(`${label} pending attendance request list failed`, { status: res.status, data: res.data });
    return [];
  }

  pass(`${label} pending attendance request list works`);

  const data = res.data?.data || {};
  if (typeof data.overallPendingCount === "number" || typeof data.employeeRangePendingCount === "number") pass(`${label} pending response includes pending counts`);
  else warn(`${label} pending response counts could not be verified`, res.data);

  return extractPendingRequests(res.data);
}

async function approveRequest(superAdminToken, requestId) {
  if (!superAdminToken || !requestId) {
    warn("Approval skipped because SUPER_ADMIN token or request id is missing");
    return;
  }

  const res = await request("PATCH", `/api/attendance-requests/${requestId}/approve`, {
    token: superAdminToken,
  });

  if (res.ok) {
    pass("SUPER_ADMIN approved attendance request");
    return;
  }

  const msg = JSON.stringify(res.data || {}).toLowerCase();
  if (msg.includes("already") || msg.includes("locked") || msg.includes("not found") || msg.includes("only pending")) {
    warn("Approval skipped/rejected due to current business/data state", { status: res.status, data: res.data });
    return;
  }

  fail("SUPER_ADMIN approve request failed", { status: res.status, data: res.data });
}

async function rejectRequest(superAdminToken, requestId) {
  if (!superAdminToken || !requestId) {
    warn("Rejection skipped because SUPER_ADMIN token or request id is missing");
    return;
  }

  const res = await request("PATCH", `/api/attendance-requests/${requestId}/reject`, {
    token: superAdminToken,
    body: { rejectionReason: "Rejected by backend workflow test" },
  });

  if (res.ok) {
    pass("SUPER_ADMIN rejected attendance request");
    return;
  }

  const msg = JSON.stringify(res.data || {}).toLowerCase();
  if (msg.includes("already") || msg.includes("not found") || msg.includes("only pending")) {
    warn("Rejection skipped/rejected due to current business/data state", { status: res.status, data: res.data });
    return;
  }

  fail("SUPER_ADMIN reject request failed", { status: res.status, data: res.data });
}

async function testDecisionEndpoint(superAdminToken, requestId) {
  if (!superAdminToken || !requestId) {
    warn("Bulk decision endpoint skipped because token or request id is missing");
    return;
  }

  const res = await request("PATCH", "/api/attendance-requests/decision", {
    token: superAdminToken,
    body: {
      requestIds: [requestId],
      action: "REJECT",
      rejectionReason: "Rejected by bulk decision workflow test",
    },
  });

  if (res.ok) pass("SUPER_ADMIN bulk decision endpoint works");
  else warn("Bulk decision endpoint could not complete, possibly because request is no longer pending", { status: res.status, data: res.data });
}

async function main() {
  console.log(`Running attendance request workflow test against: ${BASE_URL}`);
  console.log(`REQUEST_ADD_DATE=${REQUEST_ADD_DATE}`);
  console.log(`REQUEST_REJECT_DATE=${REQUEST_REJECT_DATE}`);

  await testAuthBlocks();

  const userLogin = await login("USER", USER_PHONE, USER_PASSWORD);
  const adminLogin = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const superAdminLogin = await login("SUPER_ADMIN", SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD);

  const userToken = userLogin.token;
  const adminToken = adminLogin.token;
  const superAdminToken = superAdminLogin.token;
  const userEmployeeId = userLogin.employee?.id;

  if (!userToken) {
    fail("Cannot continue attendance request workflow without USER login");
    process.exitCode = 1;
    return;
  }

  await testRoleBlocks(userToken, adminToken);
  await testInvalidCreate(userToken);

  const addResult = await createAddRequest(
    userToken,
    REQUEST_ADD_DATE,
    "PRESENT",
    "Backend workflow test add attendance request",
  );

  await testDuplicatePending(userToken);
  const myRequests = await testMyRequests(userToken);

  const pendingForAdmin = await testPendingRequests(adminToken, "ADMIN", userEmployeeId);
  const pendingForSuperAdmin = await testPendingRequests(superAdminToken, "SUPER_ADMIN", userEmployeeId);

  const addRequestId = addResult.id || findRequestId({ data: myRequests }, pendingForSuperAdmin) || findRequestId({ data: pendingForAdmin }, pendingForAdmin);

  await approveRequest(superAdminToken, addRequestId);

  const rejectResult = await createAddRequest(
    userToken,
    REQUEST_REJECT_DATE,
    "ABSENT",
    "Backend workflow test reject attendance request",
  );

  let rejectRequestId = rejectResult.id;
  if (!rejectRequestId) {
    const pendingAfter = await testPendingRequests(superAdminToken, "SUPER_ADMIN after approve", userEmployeeId);
    rejectRequestId = pendingAfter.find((item) => String(item.attendanceDate || "").slice(0, 10) === REQUEST_REJECT_DATE)?.id || null;
  }

  await rejectRequest(superAdminToken, rejectRequestId);

  const decisionResult = await createAddRequest(
    userToken,
    process.env.REQUEST_DECISION_DATE || "2026-05-20",
    "HALF_DAY",
    "Backend workflow test bulk decision request",
  );
  await testDecisionEndpoint(superAdminToken, decisionResult.id);

  await testMyRequests(userToken);

  console.log("\nAttendance request workflow test completed.");
  console.log(`Passed: ${passed}`);
  console.log(`Warnings: ${warned}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Attendance request workflow test crashed:", error);
  process.exit(1);
});
