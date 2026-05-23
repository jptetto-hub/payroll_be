import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL } from "./helpers.js";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      phone: __ENV.ADMIN_PHONE || "9999999999",
      password: __ENV.ADMIN_PASSWORD || "Password@123",
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  check(res, {
    "login ok": (r) => r.status === 200,
    "login under 1s": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
