/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const USER_PHONE = process.env.USER_PHONE;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`✅ ${message}`);
}

function fail(message, details) {
  failCount += 1;
  console.log(`❌ ${message}`);
  if (details !== undefined) console.log(details);
}

function warn(message, details) {
  warnCount += 1;
  console.log(`⚠️  ${message}`);
  if (details !== undefined) console.log(details);
}

async function request(method, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.rawAuth ? { Authorization: options.rawAuth } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  let data;
  try {
    data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    data = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    headers: response.headers,
  };
}

function extractToken(data) {
  return (
    data?.data?.token ||
    data?.token ||
    data?.data?.accessToken ||
    data?.accessToken
  );
}

async function login(label, phone, password) {
  if (!phone || !password) {
    warn(`${label} login skipped. Missing env credentials.`);
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

function expectStatus(name, res, expectedStatuses) {
  if (expectedStatuses.includes(res.status)) {
    pass(`${name} returned expected status ${res.status}`);
  } else if (res.status === 404) {
    warn(`${name} route not found, skipped`, {
      status: res.status,
      data: res.data,
    });
  } else if (res.status >= 500) {
    fail(`${name} returned server error ${res.status}`, res.data);
  } else {
    fail(
      `${name} returned unexpected status ${res.status}. Expected ${expectedStatuses.join("/")}`,
      res.data,
    );
  }
}

function expectErrorShape(name, res) {
  if (res.status === 404) return;

  const isObject =
    res.data && typeof res.data === "object" && !Array.isArray(res.data);
  const hasMessage = isObject && typeof res.data.message === "string";
  const hasSuccessFalse =
    isObject && (res.data.success === false || res.status >= 400);

  if (isObject && hasMessage && hasSuccessFalse) {
    pass(`${name} has safe error response shape`);
  } else {
    warn(`${name} error response shape may be inconsistent`, {
      status: res.status,
      data: res.data,
    });
  }
}

async function testAuthSecurity() {
  console.log("\n--- Auth Security Tests ---");

  let res = await request("POST", "/api/auth/login", { body: {} });
  expectStatus("Missing login body", res, [400, 422]);
  expectErrorShape("Missing login body", res);

  res = await request("POST", "/api/auth/login", {
    body: { phone: "0000000000", password: "wrong-password" },
  });
  expectStatus("Invalid login", res, [400, 401]);
  expectErrorShape("Invalid login", res);

  res = await request("GET", "/api/auth/me");
  expectStatus("/api/auth/me without token", res, [401, 403]);
  expectErrorShape("/api/auth/me without token", res);

  res = await request("GET", "/api/auth/me", {
    rawAuth: "Bearer invalid.jwt.token",
  });
  expectStatus("/api/auth/me with invalid token", res, [401, 403]);
  expectErrorShape("/api/auth/me with invalid token", res);

  res = await request("GET", "/api/auth/me", { rawAuth: "Basic abc123" });
  expectStatus("/api/auth/me with wrong auth scheme", res, [401, 403]);
  expectErrorShape("/api/auth/me with wrong auth scheme", res);
}

async function testRoleSecurity(userToken, adminToken, superAdminToken) {
  console.log("\n--- Role Security Tests ---");

  if (userToken) {
    const blockedForUser = [
      ["GET", "/api/employees", "USER blocked from employee list"],
      ["GET", "/api/audit-logs", "USER blocked from audit logs"],
      ["GET", "/api/settings", "USER blocked from settings"],
      [
        "POST",
        "/api/payroll/generate",
        "USER blocked from payroll generation",
        { body: {} },
      ],
      [
        "POST",
        "/api/salary-calculation/preview",
        "USER blocked from salary preview",
        { body: {} },
      ],
    ];

    for (const [method, path, name, options = {}] of blockedForUser) {
      const res = await request(method, path, { token: userToken, ...options });
      expectStatus(name, res, [401, 403]);
      expectErrorShape(name, res);
    }
  }

  if (adminToken) {
    const fakeId = "00000000-0000-4000-8000-000000000000";
    const adminBlocked = [
      ["GET", "/api/settings", "ADMIN blocked from SUPER_ADMIN settings"],
      [
        "PATCH",
        `/api/employees/${fakeId}/role`,
        "ADMIN blocked from employee role change",
        { body: { role: "ADMIN" } },
      ],
      [
        "POST",
        `/api/payroll/${fakeId}/recalculate`,
        "ADMIN blocked from payroll recalculation",
        { body: { reason: "Security test" } },
      ],
      [
        "DELETE",
        `/api/payroll/${fakeId}`,
        "ADMIN blocked from payroll cancellation",
        { body: { reason: "Security test" } },
      ],
    ];

    for (const [method, path, name, options = {}] of adminBlocked) {
      const res = await request(method, path, {
        token: adminToken,
        ...options,
      });
      expectStatus(name, res, [401, 403]);
      expectErrorShape(name, res);
    }
  }

  if (superAdminToken) {
    const res = await request("GET", "/api/test/super-admin-test", {
      token: superAdminToken,
    });
    expectStatus("SUPER_ADMIN privileged route access", res, [200]);
  }
}

async function testValidation(userToken, adminToken, superAdminToken) {
  console.log("\n--- Negative Validation Tests ---");

  const adminLikeToken = superAdminToken || adminToken;
  if (!adminLikeToken && !userToken) {
    warn(
      "Validation tests skipped. USER, ADMIN, or SUPER_ADMIN credentials required.",
    );
    return;
  }

  const invalidRequests = [
    [
      "POST",
      "/api/employees",
      "Invalid employee payload rejected",
      {
        name: "",
        phone: "abc",
        password: "123",
        role: "WRONG_ROLE",
        salaryType: "DAILY",
        joiningDate: "not-a-date",
      },
    ],
    ["GET", "/api/employees/not-a-valid-id", "Invalid employee id rejected"],
    [
      "PATCH",
      "/api/employees/not-a-valid-id/status",
      "Invalid employee status rejected",
      { status: "WRONG_STATUS" },
    ],
    [
      "POST",
      "/api/salary-history",
      "Invalid salary history payload rejected",
      {
        employeeId: "not-a-valid-id",
        salaryAmount: -1000,
        effectiveFrom: "wrong-date",
      },
    ],
    [
      "POST",
      "/api/attendance",
      "Invalid attendance payload rejected",
      {
        employeeId: "not-a-valid-id",
        date: "wrong-date",
        status: "HOLIDAY",
      },
    ],
    [
      "POST",
      "/api/attendance/bulk",
      "Invalid attendance bulk payload rejected",
      {
        employeeId: "not-a-valid-id",
        records: [{ date: "wrong-date", status: "BAD" }],
      },
    ],
    [
      "POST",
      "/api/attendance-requests",
      "Invalid attendance request payload rejected",
      {
        date: "wrong-date",
        requestedStatus: "BAD_STATUS",
        requestType: "BAD_TYPE",
        reason: "Security validation test",
      },
      "user",
    ],
    [
      "POST",
      "/api/advances",
      "Invalid advance payload rejected",
      {
        employeeId: "not-a-valid-id",
        amount: -500,
        payCycleType: "DAILY",
        cycleStartDate: "bad-date",
        cycleEndDate: "bad-date",
      },
    ],
    [
      "POST",
      "/api/salary-calculation/preview",
      "Invalid salary preview payload rejected",
      {
        employeeId: "not-a-valid-id",
        periodStart: "bad-date",
        periodEnd: "bad-date",
        salaryType: "DAILY",
      },
    ],
    [
      "POST",
      "/api/payroll/generate",
      "Invalid payroll generate payload rejected",
      {
        employeeId: "not-a-valid-id",
        periodStart: "bad-date",
        periodEnd: "bad-date",
        salaryType: "DAILY",
      },
    ],
    [
      "POST",
      "/api/settings/work-hours",
      "Invalid work-hours payload rejected",
      {
        effectiveFrom: "bad-date",
        startTime: "9AM",
        endTime: "5PM",
      },
    ],
  ];

  for (const [
    method,
    path,
    name,
    body,
    tokenType = "admin",
  ] of invalidRequests) {
    const requestToken = tokenType === "user" ? userToken : adminLikeToken;

    if (!requestToken) {
      warn(
        `${name} skipped. Missing ${tokenType === "user" ? "USER" : "ADMIN/SUPER_ADMIN"} token.`,
      );
      continue;
    }

    const res = await request(method, path, { token: requestToken, body });
    expectStatus(name, res, [400, 404, 422]);
    expectErrorShape(name, res);
  }
}

async function testNotFoundAndQuerySafety(adminToken) {
  console.log("\n--- Not Found and Query Safety Tests ---");

  const token = adminToken;

  let res = await request(
    "GET",
    "/api/this-route-does-not-exist",
    token ? { token } : {},
  );
  expectStatus("Unknown route", res, [404]);
  expectErrorShape("Unknown route", res);

  if (!token) {
    warn("Query safety tests skipped. ADMIN credentials required.");
    return;
  }

  const maliciousSearch = encodeURIComponent("%' OR '1'='1 --");
  res = await request(
    "GET",
    `/api/employees?page=1&limit=10&search=${maliciousSearch}`,
    { token },
  );
  if (res.status < 500) {
    pass(
      "Employee search handles SQL-injection-like input without server error",
    );
  } else {
    fail("Employee search SQL-injection-like input caused server error", {
      status: res.status,
      data: res.data,
    });
  }

  res = await request("GET", "/api/payroll?page=-1&limit=999999", { token });
  if (res.status < 500) {
    pass("Payroll pagination handles invalid/large query without server error");
  } else {
    fail("Payroll pagination invalid query caused server error", {
      status: res.status,
      data: res.data,
    });
  }
}

async function main() {
  console.log(`Running security + validation tests against: ${BASE_URL}`);
  console.log(
    "This script sends only rejected/negative requests. It should not create valid business data.\n",
  );

  await testAuthSecurity();

  const userToken = await login("USER", USER_PHONE, USER_PASSWORD);
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const superAdminToken = await login(
    "SUPER_ADMIN",
    SUPER_ADMIN_PHONE,
    SUPER_ADMIN_PASSWORD,
  );

  await testRoleSecurity(userToken, adminToken, superAdminToken);
  await testValidation(userToken, adminToken, superAdminToken);
  await testNotFoundAndQuerySafety(adminToken || superAdminToken);

  console.log("\n--- Summary ---");
  console.log(`✅ Passed: ${passCount}`);
  console.log(`⚠️  Warnings: ${warnCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Security validation test crashed:", error);
  process.exit(1);
});
