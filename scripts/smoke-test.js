/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const USER_PHONE = process.env.USER_PHONE;
const USER_PASSWORD = process.env.USER_PASSWORD;

async function request(method, path, options = {}) {
  const url = `${BASE_URL}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
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

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function login(label, phone, password) {
  if (!phone || !password) {
    console.log(`⚠️  ${label} login skipped. Missing env values.`);
    return null;
  }

  const res = await request("POST", "/api/auth/login", {
    body: {
      phone,
      password,
    },
  });

  if (!res.ok) {
    console.log(`❌ ${label} login failed`, res.status, res.data);
    return null;
  }

  const token =
    res.data?.data?.token ||
    res.data?.token ||
    res.data?.accessToken ||
    res.data?.data?.accessToken;

  if (!token) {
    console.log(`❌ ${label} login success but token not found`, res.data);
    return null;
  }

  console.log(`✅ ${label} login passed`);
  return token;
}

async function testPublicHealth() {
  const res = await request("GET", "/health");

  if (res.ok) {
    console.log("✅ Health check passed");
  } else {
    console.log("❌ Health check failed", res.status, res.data);
  }
}

async function testUnauthorizedRoutes() {
  const protectedRoutes = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/employees"],
    ["GET", "/api/attendance"],
    ["GET", "/api/payroll"],
    ["GET", "/api/payslips"],
    ["GET", "/api/ledger"],
    ["GET", "/api/reports/salary"],
    ["GET", "/api/audit-logs"],
    ["GET", "/api/settings"],
    ["GET", "/api/dashboard/summary"],
  ];

  console.log("\n--- Unauthorized Route Tests ---");

  for (const [method, path] of protectedRoutes) {
    const res = await request(method, path);

    if (res.status === 401 || res.status === 403) {
      console.log(`✅ ${method} ${path} blocked without token`);
    } else {
      console.log(
        `❌ ${method} ${path} should block without token, got ${res.status}`,
        res.data,
      );
    }
  }
}

async function testAdminRoutes(adminToken) {
  if (!adminToken) return;

  const routes = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/employees"],
    ["GET", "/api/attendance"],
    ["GET", "/api/advances"],
    ["GET", "/api/payroll"],
    ["GET", "/api/payslips"],
    ["GET", "/api/ledger"],
    ["GET", "/api/reports/salary"],
    ["GET", "/api/reports/attendance"],
    ["GET", "/api/reports/advance"],
    ["GET", "/api/settings/work-hours"],
    ["GET", "/api/dashboard/summary"],
  ];

  console.log("\n--- Admin Smoke Tests ---");

  for (const [method, path] of routes) {
    const res = await request(method, path, { token: adminToken });

    if (res.status < 500) {
      console.log(`✅ ${method} ${path} responded with ${res.status}`);
    } else {
      console.log(`❌ ${method} ${path} server error`, res.status, res.data);
    }
  }
}

async function testSuperAdminRoutes(superAdminToken) {
  if (!superAdminToken) return;

  const routes = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/employees"],
    ["GET", "/api/audit-logs"],
    ["GET", "/api/settings"],
    ["GET", "/api/settings/work-hours"],
    ["GET", "/api/scheduler/runs"],
    ["GET", "/api/test/admin-test"],
    ["GET", "/api/test/super-admin-test"],
  ];

  console.log("\n--- Super Admin Smoke Tests ---");

  for (const [method, path] of routes) {
    const res = await request(method, path, { token: superAdminToken });

    if (res.status < 500) {
      console.log(`✅ ${method} ${path} responded with ${res.status}`);
    } else {
      console.log(`❌ ${method} ${path} server error`, res.status, res.data);
    }
  }
}

async function testUserRoutes(userToken) {
  if (!userToken) return;

  const allowedRoutes = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/attendance-requests/my"],
    ["GET", "/api/advances/my"],
    ["GET", "/api/payroll"],
    ["GET", "/api/payslips/my"],
    ["GET", "/api/ledger/my"],
    ["GET", "/api/reports/salary"],
    ["GET", "/api/dashboard/summary"],
  ];

  const blockedRoutes = [
    ["GET", "/api/employees"],
    ["GET", "/api/audit-logs"],
    ["GET", "/api/settings"],
    ["GET", "/api/test/admin-test"],
    ["GET", "/api/test/super-admin-test"],
  ];

  console.log("\n--- User Allowed Route Smoke Tests ---");

  for (const [method, path] of allowedRoutes) {
    const res = await request(method, path, { token: userToken });

    if (res.status < 500) {
      console.log(`✅ ${method} ${path} responded with ${res.status}`);
    } else {
      console.log(`❌ ${method} ${path} server error`, res.status, res.data);
    }
  }

  console.log("\n--- User Blocked Route Tests ---");

  for (const [method, path] of blockedRoutes) {
    const res = await request(method, path, { token: userToken });

    if (res.status === 401 || res.status === 403) {
      console.log(`✅ ${method} ${path} blocked for USER`);
    } else {
      console.log(
        `❌ ${method} ${path} should block USER, got ${res.status}`,
        res.data,
      );
    }
  }
}

async function main() {
  console.log(`Running smoke tests against: ${BASE_URL}`);

  await testPublicHealth();
  await testUnauthorizedRoutes();

  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const superAdminToken = await login(
    "SUPER_ADMIN",
    SUPER_ADMIN_PHONE,
    SUPER_ADMIN_PASSWORD,
  );
  const userToken = await login("USER", USER_PHONE, USER_PASSWORD);

  await testAdminRoutes(adminToken);
  await testSuperAdminRoutes(superAdminToken);
  await testUserRoutes(userToken);

  console.log("\nSmoke testing completed.");
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
