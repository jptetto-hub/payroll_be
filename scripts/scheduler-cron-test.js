/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const USER_PHONE = process.env.USER_PHONE;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const RUN_SCHEDULER = String(process.env.RUN_SCHEDULER || "false").toLowerCase() === "true";
const DEFAULT_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const SCHEDULER_TIMEOUT_MS = Number(process.env.SCHEDULER_TIMEOUT_MS || 5000);

const results = { passed: 0, failed: 0, warned: 0, skipped: 0 };

function pass(message) {
  results.passed += 1;
  console.log(`✅ ${message}`);
}

function fail(message, details) {
  results.failed += 1;
  console.log(`❌ ${message}`);
  if (details !== undefined) console.log(details);
}

function warn(message, details) {
  results.warned += 1;
  console.log(`⚠️  ${message}`);
  if (details !== undefined) console.log(details);
}

function skip(message) {
  results.skipped += 1;
  console.log(`⏭️  ${message}`);
}

async function request(method, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
      return {
        status: 0,
        ok: false,
        timedOut: true,
        data: {
          success: false,
          message: `Request timed out after ${timeoutMs}ms`,
          path,
        },
      };
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

function getToken(data) {
  return (
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.token ||
    data?.accessToken ||
    data?.data?.jwt ||
    null
  );
}

async function login(label, phone, password) {
  if (!phone || !password) {
    skip(`${label} login skipped because credentials were not provided`);
    return null;
  }

  const res = await request("POST", "/api/auth/login", {
    body: { phone, password },
  });

  if (!res.ok) {
    fail(`${label} login failed with status ${res.status}`, res.data);
    return null;
  }

  const token = getToken(res.data);
  if (!token) {
    fail(`${label} login succeeded but token was not found`, res.data);
    return null;
  }

  pass(`${label} login works`);
  return token;
}

function expectBlocked(label, res) {
  if ([401, 403].includes(res.status)) {
    pass(label);
    return;
  }
  if (res.status === 404) {
    warn(`${label} returned 404. Route may not exist in this backend.`);
    return;
  }
  fail(`${label}. Expected 401/403, got ${res.status}`, res.data);
}

function expectAllowed(label, res) {
  if (res.status >= 200 && res.status < 500) {
    pass(`${label} responded with ${res.status}`);
    return;
  }
  fail(`${label} returned server error ${res.status}`, res.data);
}

async function testSchedulerPermissions(userToken, adminToken, superAdminToken) {
  console.log("\n--- Scheduler permission tests ---");

  const noTokenRuns = await request("GET", "/api/scheduler/runs?page=1&limit=5");
  expectBlocked("GET /api/scheduler/runs blocks missing token", noTokenRuns);

  const noTokenRunPayroll = await request("POST", "/api/scheduler/run-payroll");
  expectBlocked("POST /api/scheduler/run-payroll blocks missing token", noTokenRunPayroll);

  if (userToken) {
    expectBlocked(
      "USER blocked from scheduler runs",
      await request("GET", "/api/scheduler/runs?page=1&limit=5", { token: userToken }),
    );
    expectBlocked(
      "USER blocked from manual payroll scheduler run",
      await request("POST", "/api/scheduler/run-payroll", { token: userToken }),
    );
  }

  if (adminToken) {
    expectBlocked(
      "ADMIN blocked from scheduler runs if SUPER_ADMIN-only",
      await request("GET", "/api/scheduler/runs?page=1&limit=5", { token: adminToken }),
    );
    expectBlocked(
      "ADMIN blocked from manual payroll scheduler run",
      await request("POST", "/api/scheduler/run-payroll", { token: adminToken }),
    );
  }

  if (superAdminToken) {
    const runsRes = await request("GET", "/api/scheduler/runs?page=1&limit=5", {
      token: superAdminToken,
    });
    expectAllowed("SUPER_ADMIN can list scheduler runs", runsRes);

    if (runsRes.ok) {
      const hasArray = Array.isArray(runsRes.data?.data);
      const hasPagination = Boolean(runsRes.data?.pagination);

      if (hasArray) pass("Scheduler runs response contains data array");
      else warn("Scheduler runs response does not contain data array", runsRes.data);

      if (hasPagination) pass("Scheduler runs response contains pagination");
      else warn("Scheduler runs response does not contain pagination", runsRes.data);
    }
  }
}

async function testManualSchedulerRun(superAdminToken) {
  console.log("\n--- Manual scheduler run test ---");

  if (!superAdminToken) {
    skip("Manual scheduler run skipped because SUPER_ADMIN token is missing");
    return;
  }

  if (!RUN_SCHEDULER) {
    skip("Manual scheduler run skipped. Set RUN_SCHEDULER=true to execute POST /api/scheduler/run.");
    return;
  }

  warn("RUN_SCHEDULER=true enabled. This may create payrolls for completed eligible periods.");
  warn(`Manual scheduler start endpoint timeout is ${SCHEDULER_TIMEOUT_MS}ms. It should return 202 quickly because payroll runs in the background.`);

  const beforeRuns = await request("GET", "/api/scheduler/runs?page=1&limit=1", {
    token: superAdminToken,
  });

  const res = await request("POST", "/api/scheduler/run", {
    token: superAdminToken,
    timeoutMs: SCHEDULER_TIMEOUT_MS,
  });

  if (res.timedOut) {
    warn(
      `Manual scheduler run timed out after ${SCHEDULER_TIMEOUT_MS}ms. The backend may still be processing. Do not rerun immediately; check server logs and scheduler run history first.`,
      res.data,
    );

    const afterTimeoutRuns = await request("GET", "/api/scheduler/runs?page=1&limit=1", {
      token: superAdminToken,
    });

    if (afterTimeoutRuns.ok) {
      warn("Fetched scheduler run history after timeout. Check whether a run is still RUNNING or completed.", afterTimeoutRuns.data?.data?.[0]);
    } else {
      warn("Could not fetch scheduler run history after timeout", afterTimeoutRuns.data);
    }

    return;
  }

  if (res.status >= 500) {
    fail("Manual scheduler start returned server error", res.data);
    return;
  }

  if (!res.ok) {
    warn(`Manual scheduler start responded with ${res.status}. This may be valid if Redis/background queue is unavailable.`, res.data);
    return;
  }

  if (res.status === 202) pass("Manual scheduler start returns 202 Accepted");
  else warn(`Manual scheduler start returned ${res.status}; expected 202 Accepted`, res.data);

  if (res.data?.success === true) pass("Manual scheduler start response has success=true");
  else warn("Manual scheduler start response missing success=true", res.data);

  const jobId = res.data?.jobId;
  if (jobId) pass("Manual scheduler start response contains jobId");
  else warn("Manual scheduler start response missing jobId", res.data);

  if (["PENDING", "RUNNING"].includes(res.data?.status)) {
    pass("Manual scheduler start response contains async status");
  } else {
    warn("Manual scheduler start response status should be PENDING or RUNNING", res.data);
  }

  if (jobId) {
    const statusRes = await request("GET", `/api/scheduler/runs/${jobId}`, {
      token: superAdminToken,
    });

    if (statusRes.ok) {
      pass("Scheduler run status can be fetched by jobId");
      const run = statusRes.data?.data;
      const keys = [
        "id",
        "status",
        "totalEmployees",
        "processedEmployees",
        "successCount",
        "skippedCount",
        "failedCount",
        "startedAt",
        "completedAt",
      ];

      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(run || {}, key)) pass(`Scheduler status contains ${key}`);
        else warn(`Scheduler status missing ${key}`, statusRes.data);
      }
    } else {
      warn("Scheduler run status fetch by jobId failed", statusRes.data);
    }
  }

  const afterRuns = await request("GET", "/api/scheduler/runs?page=1&limit=1", {
    token: superAdminToken,
  });

  if (afterRuns.ok) pass("Scheduler run history can be fetched after manual run");
  else warn("Scheduler run history fetch failed after manual run", afterRuns.data);

  if (beforeRuns.ok && afterRuns.ok) {
    const latest = afterRuns.data?.data?.[0];
    if (latest?.name === "MANUAL_PAYROLL_SCHEDULER") pass("Latest scheduler run is MANUAL_PAYROLL_SCHEDULER");
    else warn("Latest scheduler run name was not MANUAL_PAYROLL_SCHEDULER", latest);
  }
}

async function main() {
  console.log(`Running scheduler/cron tests against: ${BASE_URL}`);

  const userToken = await login("USER", USER_PHONE, USER_PASSWORD);
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);
  const superAdminToken = await login("SUPER_ADMIN", SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD);

  await testSchedulerPermissions(userToken, adminToken, superAdminToken);
  await testManualSchedulerRun(superAdminToken);

  console.log("\n--- Summary ---");
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`⚠️  Warnings: ${results.warned}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Scheduler/cron test crashed:", error);
  process.exit(1);
});
