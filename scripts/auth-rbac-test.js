/* eslint-disable no-console */

/**
 * Simple non-destructive Auth + RBAC test for payroll attendance API.
 *
 * Run:
 * BASE_URL=http://localhost:5000 \
 * ADMIN_PHONE=... ADMIN_PASSWORD=... \
 * SUPER_ADMIN_PHONE=... SUPER_ADMIN_PASSWORD=... \
 * USER_PHONE=... USER_PASSWORD=... \
 * npm run test:auth-rbac
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const credentials = {
  USER: {
    phone: process.env.USER_PHONE,
    password: process.env.USER_PASSWORD,
  },
  ADMIN: {
    phone: process.env.ADMIN_PHONE,
    password: process.env.ADMIN_PASSWORD,
  },
  SUPER_ADMIN: {
    phone: process.env.SUPER_ADMIN_PHONE,
    password: process.env.SUPER_ADMIN_PASSWORD,
  },
};

const results = [];

function log(pass, label, detail = "") {
  results.push({ pass, label, detail });
  console.log(`${pass ? "✅" : "❌"} ${label}${detail ? ` - ${detail}` : ""}`);
}

async function request(method, path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.rawAuthorization ? { Authorization: options.rawAuthorization } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

function extractToken(data) {
  return (
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.token ||
    data?.accessToken ||
    data?.access_token
  );
}

function extractRole(data) {
  return (
    data?.data?.role ||
    data?.data?.employee?.role ||
    data?.data?.user?.role ||
    data?.role ||
    data?.employee?.role ||
    data?.user?.role
  );
}

async function login(role) {
  const { phone, password } = credentials[role];

  if (!phone || !password) {
    log(false, `${role} login skipped`, "missing phone/password env values");
    return null;
  }

  const res = await request("POST", "/api/auth/login", {
    body: { phone, password },
  });

  const token = extractToken(res.data);

  if (res.ok && token) {
    log(true, `${role} login`, `status ${res.status}`);
    return token;
  }

  log(false, `${role} login`, `status ${res.status}; token not found`);
  console.log(res.data);
  return null;
}

async function testInvalidLogin() {
  console.log("\n--- Invalid Login Tests ---");

  const missingBody = await request("POST", "/api/auth/login", { body: {} });
  log(
    [400, 422].includes(missingBody.status),
    "Missing login body is rejected",
    `status ${missingBody.status}`,
  );

  const invalidUser = await request("POST", "/api/auth/login", {
    body: {
      phone: "0000000000",
      password: "wrong-password",
    },
  });
  log(
    [400, 401, 404].includes(invalidUser.status),
    "Invalid login is rejected",
    `status ${invalidUser.status}`,
  );
}

async function testTokenProtection() {
  console.log("\n--- Token Protection Tests ---");

  const noToken = await request("GET", "/api/auth/me");
  log(
    [401, 403].includes(noToken.status),
    "GET /api/auth/me blocks missing token",
    `status ${noToken.status}`,
  );

  const badToken = await request("GET", "/api/auth/me", {
    token: "invalid.jwt.token",
  });
  log(
    [401, 403].includes(badToken.status),
    "GET /api/auth/me blocks malformed token",
    `status ${badToken.status}`,
  );

  const badBearerFormat = await request("GET", "/api/auth/me", {
    rawAuthorization: "NotBearer abcdef",
  });
  log(
    [401, 403].includes(badBearerFormat.status),
    "GET /api/auth/me blocks wrong Authorization format",
    `status ${badBearerFormat.status}`,
  );
}

async function testMeEndpoint(role, token) {
  if (!token) return;

  const res = await request("GET", "/api/auth/me", { token });
  const responseRole = extractRole(res.data);

  log(
    res.ok,
    `${role} can access own profile /api/auth/me`,
    `status ${res.status}`,
  );

  if (responseRole) {
    log(
      responseRole === role,
      `${role} /me role matches token user`,
      `returned role ${responseRole}`,
    );
  } else {
    log(true, `${role} /me role check skipped`, "role field not found in response");
  }
}

async function expectStatus(role, token, method, path, expectedStatuses, label) {
  if (!token) return;

  const res = await request(method, path, { token });
  const pass = expectedStatuses.includes(res.status);

  log(
    pass,
    `${role}: ${label}`,
    `${method} ${path} returned ${res.status}; expected ${expectedStatuses.join("/")}`,
  );

  if (!pass) {
    console.log(res.data);
  }
}

async function testRoleMatrix(tokens) {
  console.log("\n--- RBAC Matrix Tests ---");

  await expectStatus("USER", tokens.USER, "GET", "/api/test/admin-test", [403], "blocked from ADMIN test route");
  await expectStatus("USER", tokens.USER, "GET", "/api/test/super-admin-test", [403], "blocked from SUPER_ADMIN test route");
  await expectStatus("USER", tokens.USER, "GET", "/api/employees", [403], "blocked from employee admin list");
  await expectStatus("USER", tokens.USER, "GET", "/api/audit-logs", [403], "blocked from audit logs");

  await expectStatus("ADMIN", tokens.ADMIN, "GET", "/api/test/admin-test", [200], "allowed on ADMIN test route");
  await expectStatus("ADMIN", tokens.ADMIN, "GET", "/api/test/super-admin-test", [403], "blocked from SUPER_ADMIN test route");
  await expectStatus("ADMIN", tokens.ADMIN, "GET", "/api/employees", [200], "allowed on employee admin list");
  await expectStatus("ADMIN", tokens.ADMIN, "GET", "/api/audit-logs", [200, 403], "audit logs follow configured role rule");

  await expectStatus("SUPER_ADMIN", tokens.SUPER_ADMIN, "GET", "/api/test/admin-test", [200], "allowed on ADMIN test route");
  await expectStatus("SUPER_ADMIN", tokens.SUPER_ADMIN, "GET", "/api/test/super-admin-test", [200], "allowed on SUPER_ADMIN test route");
  await expectStatus("SUPER_ADMIN", tokens.SUPER_ADMIN, "GET", "/api/employees", [200], "allowed on employee admin list");
  await expectStatus("SUPER_ADMIN", tokens.SUPER_ADMIN, "GET", "/api/audit-logs", [200], "allowed on audit logs");
}

async function testSuperAdminOnlyWriteProtection(tokens) {
  console.log("\n--- SUPER_ADMIN-only Endpoint Protection Tests ---");

  // These requests use fake ids and intentionally invalid/missing bodies.
  // The important check is that USER/ADMIN should be blocked by RBAC before business logic.
  await expectStatus("USER", tokens.USER, "PATCH", "/api/employees/fake-id/role", [403], "blocked from employee role change");
  await expectStatus("ADMIN", tokens.ADMIN, "PATCH", "/api/employees/fake-id/role", [403], "blocked from employee role change");

  await expectStatus("USER", tokens.USER, "POST", "/api/payroll/fake-id/recalculate", [403], "blocked from payroll recalculation");
  await expectStatus("ADMIN", tokens.ADMIN, "POST", "/api/payroll/fake-id/recalculate", [403], "blocked from payroll recalculation");

  await expectStatus("USER", tokens.USER, "DELETE", "/api/payroll/fake-id", [403], "blocked from payroll cancellation/delete");
  await expectStatus("ADMIN", tokens.ADMIN, "DELETE", "/api/payroll/fake-id", [403], "blocked from payroll cancellation/delete");
}

async function main() {
  console.log(`Running Auth + RBAC tests against: ${BASE_URL}`);

  await testInvalidLogin();
  await testTokenProtection();

  console.log("\n--- Valid Login Tests ---");
  const tokens = {
    USER: await login("USER"),
    ADMIN: await login("ADMIN"),
    SUPER_ADMIN: await login("SUPER_ADMIN"),
  };

  console.log("\n--- /me Tests ---");
  await testMeEndpoint("USER", tokens.USER);
  await testMeEndpoint("ADMIN", tokens.ADMIN);
  await testMeEndpoint("SUPER_ADMIN", tokens.SUPER_ADMIN);

  await testRoleMatrix(tokens);
  await testSuperAdminOnlyWriteProtection(tokens);

  const failed = results.filter((item) => !item.pass);
  console.log("\n--- Summary ---");
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const item of failed) {
      console.log(`- ${item.label}${item.detail ? ` (${item.detail})` : ""}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Auth + RBAC test crashed:", error);
  process.exit(1);
});
