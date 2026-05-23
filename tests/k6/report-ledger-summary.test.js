import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "./helpers.js";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

export function setup() {
  return {
    token: login(),
  };
}

export default function (data) {
  const from = __ENV.REPORT_FROM || "2026-05-01";
  const to = __ENV.REPORT_TO || "2026-05-31";
  const res = http.get(
    `${BASE_URL}/api/reports/ledger-summary?from=${from}&to=${to}`,
    authHeaders(data.token),
  );

  check(res, {
    "ledger summary ok": (r) => r.status === 200,
    "ledger summary under 2s": (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
