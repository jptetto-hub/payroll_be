import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "./helpers.js";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export function setup() {
  return {
    token: login(),
  };
}

export default function (data) {
  const employeeId = __ENV.EMPLOYEE_ID;
  const from = __ENV.ATTENDANCE_FROM || "2026-05-01";
  const to = __ENV.ATTENDANCE_TO || "2026-05-31";

  if (!employeeId) {
    throw new Error("EMPLOYEE_ID is required for attendance range test");
  }

  const res = http.get(
    `${BASE_URL}/api/attendance/employee/${employeeId}/range?from=${from}&to=${to}&page=1&limit=50`,
    authHeaders(data.token),
  );

  check(res, {
    "attendance range ok": (r) => r.status === 200,
    "attendance range under 1s": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
