import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const TOKEN = __ENV.SUPER_ADMIN_TOKEN;

export default function () {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  const res = http.get(`${BASE_URL}/api/payroll`, { headers });

  check(res, {
    "payroll list status is not 500": (r) => r.status < 500,
    "payroll list response under 1s": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
