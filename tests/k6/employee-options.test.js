import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "./helpers.js";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export function setup() {
  return {
    token: login(),
  };
}

export default function (data) {
  const search = __ENV.SEARCH || "";
  const res = http.get(
    `${BASE_URL}/api/employees/options?search=${encodeURIComponent(search)}&limit=20`,
    authHeaders(data.token),
  );

  check(res, {
    "employee options ok": (r) => r.status === 200,
    "employee options under 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
