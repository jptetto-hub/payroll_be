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
    jobId: __ENV.JOB_ID,
  };
}

export default function (data) {
  if (!data.jobId) {
    throw new Error("JOB_ID is required");
  }

  const res = http.get(
    `${BASE_URL}/api/scheduler/runs/${data.jobId}`,
    authHeaders(data.token),
  );

  check(res, {
    "scheduler status ok": (r) => r.status === 200,
    "scheduler status fast": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
