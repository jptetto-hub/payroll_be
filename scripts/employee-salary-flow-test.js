/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const TEST_PASSWORD = process.env.TEST_EMPLOYEE_PASSWORD || "Password@123";

function isoDate(date) {
  return `${date}T00:00:00.000Z`;
}

function uniqueIndianPhone(offset = 0) {
  const lastNine = String((Date.now() + offset) % 1000000000).padStart(9, "0");
  return `9${lastNine}`;
}

async function request(method, path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
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
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data };
}

function getData(res) {
  return res.data?.data || res.data;
}

function getToken(res) {
  return (
    res.data?.data?.token ||
    res.data?.token ||
    res.data?.data?.accessToken ||
    res.data?.accessToken
  );
}

async function login(label, phone, password) {
  if (!phone || !password) {
    console.log(`⚠️  ${label} login skipped. Missing env values.`);
    return null;
  }

  const res = await request("POST", "/api/auth/login", {
    body: { phone, password },
  });

  const token = getToken(res);
  if (!res.ok || !token) {
    console.log(`❌ ${label} login failed`, res.status, res.data);
    return null;
  }

  console.log(`✅ ${label} login passed`);
  return token;
}

function expectOk(label, res) {
  if (res.ok) {
    console.log(`✅ ${label} passed (${res.status})`);
    return true;
  }
  console.log(`❌ ${label} failed (${res.status})`, res.data);
  return false;
}

function expectFail(label, res) {
  if (!res.ok && res.status >= 400 && res.status < 500) {
    console.log(`✅ ${label} rejected correctly (${res.status})`);
    return true;
  }
  console.log(`❌ ${label} should fail with 4xx, got ${res.status}`, res.data);
  return false;
}

async function createEmployee(token, employee) {
  const res = await request("POST", "/api/employees", { token, body: employee });
  if (!expectOk(`Create ${employee.salaryType} employee`, res)) return null;

  const created = getData(res);
  if (!created?.id) {
    console.log("❌ Create employee response did not include data.id", res.data);
    return null;
  }

  console.log(`   Created employee: ${created.name} | ${created.id} | ${created.phone}`);
  return created;
}

async function createSalaryHistory(token, employeeId, salaryAmount, effectiveFrom) {
  const res = await request("POST", "/api/salary-history", {
    token,
    body: {
      employeeId,
      salaryAmount,
      effectiveFrom: isoDate(effectiveFrom),
    },
  });

  if (!expectOk(`Create salary history ${salaryAmount} from ${effectiveFrom}`, res)) {
    return null;
  }

  const created = getData(res);
  console.log(`   Created salary history: ${created?.id || "id not shown"}`);
  return created;
}

async function main() {
  console.log(`Running employee + salary flow test against: ${BASE_URL}`);
  console.log("This script creates clearly marked TEST employees and salary history records.");

  const superAdminToken = await login(
    "SUPER_ADMIN",
    SUPER_ADMIN_PHONE,
    SUPER_ADMIN_PASSWORD,
  );
  const adminToken = await login("ADMIN", ADMIN_PHONE, ADMIN_PASSWORD);

  const token = superAdminToken || adminToken;
  if (!token) {
    console.log("❌ No ADMIN/SUPER_ADMIN token available. Cannot continue.");
    process.exit(1);
  }

  const runId = Date.now();
  const weeklyPhone = uniqueIndianPhone(11);
  const monthlyPhone = uniqueIndianPhone(22);

  const weeklyEmployeeBody = {
    name: `TEST Weekly Employee ${runId}`,
    phone: weeklyPhone,
    email: `test.weekly.${runId}@example.com`,
    password: TEST_PASSWORD,
    designation: "Test Worker",
    department: "Testing",
    joiningDate: isoDate("2026-04-27"),
    salaryType: "WEEKLY",
    role: "USER",
    address: "Created by employee-salary-flow-test.js",
  };

  const monthlyEmployeeBody = {
    name: `TEST Monthly Employee ${runId}`,
    phone: monthlyPhone,
    email: `test.monthly.${runId}@example.com`,
    password: TEST_PASSWORD,
    designation: "Test Staff",
    department: "Testing",
    joiningDate: isoDate("2026-05-01"),
    salaryType: "MONTHLY",
    role: "USER",
    address: "Created by employee-salary-flow-test.js",
  };

  console.log("\n--- Employee Create Tests ---");
  const weeklyEmployee = await createEmployee(token, weeklyEmployeeBody);
  const monthlyEmployee = await createEmployee(token, monthlyEmployeeBody);

  if (!weeklyEmployee || !monthlyEmployee) {
    console.log("❌ Employee creation failed. Stop here and fix employee API first.");
    process.exit(1);
  }

  console.log("\n--- Employee Validation Tests ---");
  const duplicatePhone = await request("POST", "/api/employees", {
    token,
    body: {
      ...weeklyEmployeeBody,
      email: `duplicate.${runId}@example.com`,
    },
  });
  expectFail("Duplicate employee phone", duplicatePhone);

  const invalidSalaryType = await request("POST", "/api/employees", {
    token,
    body: {
      ...weeklyEmployeeBody,
      phone: uniqueIndianPhone(33),
      email: `invalid.salary.${runId}@example.com`,
      salaryType: "DAILY",
    },
  });
  expectFail("Invalid salaryType", invalidSalaryType);

  const invalidPhone = await request("POST", "/api/employees", {
    token,
    body: {
      ...weeklyEmployeeBody,
      phone: "12345",
      email: `invalid.phone.${runId}@example.com`,
    },
  });
  expectFail("Invalid phone", invalidPhone);

  console.log("\n--- Employee Read/List Tests ---");
  expectOk(
    "List employees with pagination",
    await request("GET", "/api/employees?page=1&limit=5", { token }),
  );
  expectOk(
    "Search TEST employees",
    await request("GET", `/api/employees?search=${encodeURIComponent("TEST")}&page=1&limit=10`, { token }),
  );
  expectOk(
    "Get weekly employee by id",
    await request("GET", `/api/employees/${weeklyEmployee.id}`, { token }),
  );

  console.log("\n--- Employee Update Tests ---");
  expectOk(
    "Update weekly employee department",
    await request("PATCH", `/api/employees/${weeklyEmployee.id}`, {
      token,
      body: { department: "Testing Updated" },
    }),
  );
  expectOk(
    "Update monthly employee status ACTIVE",
    await request("PATCH", `/api/employees/${monthlyEmployee.id}/status`, {
      token,
      body: { status: "ACTIVE" },
    }),
  );

  console.log("\n--- Salary History Tests ---");
  const weeklySalary = await createSalaryHistory(
    token,
    weeklyEmployee.id,
    5000,
    "2026-04-27",
  );
  const monthlySalary = await createSalaryHistory(
    token,
    monthlyEmployee.id,
    30000,
    "2026-05-01",
  );

  if (!weeklySalary || !monthlySalary) {
    console.log("❌ Salary history creation failed. Stop here and fix salary-history API first.");
    process.exit(1);
  }

  const duplicateSalary = await request("POST", "/api/salary-history", {
    token,
    body: {
      employeeId: weeklyEmployee.id,
      salaryAmount: 6000,
      effectiveFrom: isoDate("2026-04-27"),
    },
  });
  expectFail("Duplicate salary effectiveFrom for same employee", duplicateSalary);

  const invalidSalary = await request("POST", "/api/salary-history", {
    token,
    body: {
      employeeId: weeklyEmployee.id,
      salaryAmount: -100,
      effectiveFrom: isoDate("2026-04-28"),
    },
  });
  expectFail("Invalid negative salary amount", invalidSalary);

  const salaryBeforeJoining = await request("POST", "/api/salary-history", {
    token,
    body: {
      employeeId: monthlyEmployee.id,
      salaryAmount: 25000,
      effectiveFrom: isoDate("2026-04-01"),
    },
  });
  expectFail("Salary effective date before joining date", salaryBeforeJoining);

  console.log("\n--- Salary History Read/Resolve Tests ---");
  expectOk(
    "List weekly salary history",
    await request("GET", `/api/salary-history/employee/${weeklyEmployee.id}?page=1&limit=5`, { token }),
  );
  expectOk(
    "Get weekly current salary",
    await request("GET", `/api/salary-history/employee/${weeklyEmployee.id}/current`, { token }),
  );
  expectOk(
    "Resolve weekly salary by date",
    await request("GET", `/api/salary-history/employee/${weeklyEmployee.id}/resolve?date=2026-05-02`, { token }),
  );

  console.log("\nEmployee + salary flow test completed.");
  console.log("Created test records:");
  console.log(`WEEKLY_EMPLOYEE_ID=${weeklyEmployee.id}`);
  console.log(`MONTHLY_EMPLOYEE_ID=${monthlyEmployee.id}`);
  console.log("Save these ids for Step 4 Attendance + Salary Calculation testing.");
}

main().catch((error) => {
  console.error("Employee + salary flow test crashed:", error);
  process.exit(1);
});
