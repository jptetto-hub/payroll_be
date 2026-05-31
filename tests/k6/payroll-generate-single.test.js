import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "./helpers.js";

export const options = {
  vus: Number(__ENV.VUS || 1),
  iterations: Number(__ENV.ITERATIONS || 1),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

export function setup() {
  return {
    token: login(),
  };
}

export default function (data) {
  if (!__ENV.EMPLOYEE_ID) {
    throw new Error("EMPLOYEE_ID is required");
  }

  const payload = {
    employeeId: __ENV.EMPLOYEE_ID,
    periodStart: __ENV.PERIOD_START || "2026-05-01",
    periodEnd: __ENV.PERIOD_END || "2026-05-31",
  };

  const res = http.post(
    `${BASE_URL}/api/payroll/generate`,
    JSON.stringify(payload),
    authHeaders(data.token),
  );

  check(res, {
    "payroll generate success or duplicate": (r) =>
      [200, 201, 202, 400, 409].includes(r.status),
    "payroll generate queued under 1s": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
