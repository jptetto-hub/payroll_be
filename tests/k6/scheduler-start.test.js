import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "./helpers.js";

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || "30s",
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
  const res = http.post(
    `${BASE_URL}/api/scheduler/run`,
    JSON.stringify({}),
    authHeaders(data.token),
  );

  check(res, {
    "scheduler start accepted or conflict": (r) =>
      r.status === 202 || r.status === 409,
    "scheduler start fast": (r) => r.timings.duration < 500,
  });

  sleep(5);
}
