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
  const res = http.get(
    `${BASE_URL}/api/payslips?page=1&limit=20`,
    authHeaders(data.token),
  );

  check(res, {
    "payslip list ok": (r) => r.status === 200,
    "payslip list under 1s": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
