import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const payrollListErrors = new Rate("payroll_list_errors");
export const payrollListDuration = new Trend("payroll_list_duration_ms");

const VUS = Number(__ENV.STRESS_VUS || 10);
const DURATION = __ENV.STRESS_DURATION || "30s";
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || 1000);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: [`p(95)<${MAX_P95_MS}`],
    payroll_list_errors: ["rate<0.01"],
    payroll_list_duration_ms: [`p(95)<${MAX_P95_MS}`],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const TOKEN = __ENV.SUPER_ADMIN_TOKEN;

export default function () {
  if (!TOKEN) {
    console.error("Missing SUPER_ADMIN_TOKEN");
    payrollListErrors.add(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  const started = Date.now();
  const res = http.get(`${BASE_URL}/api/payroll?limit=20`, { headers });
  payrollListDuration.add(Date.now() - started);

  const ok = check(res, {
    "payroll list status is not 500": (r) => r.status < 500,
    "payroll list response under 1s": (r) => r.timings.duration < 1000,
  });
  payrollListErrors.add(!ok || res.status >= 500);

  sleep(1);
}

export function handleSummary(data) {
  const p95 = data.metrics.payroll_list_duration_ms?.percentiles?.["95"] || "n/a";
  const failedRate = data.metrics.http_req_failed?.rate || 0;

  return {
    stdout: `\nPayroll list stress completed.\nRequests: ${data.metrics.http_reqs?.count || 0}\nFailed request rate: ${failedRate}\nPayroll list p95 ms: ${p95}\n\nIf this fails thresholds, restart the API with:\nENABLE_PRISMA_QUERY_LOG=true ENABLE_PERFORMANCE_LOG=true SLOW_QUERY_MS=200 SLOW_API_MS=500 npm run dev\n\nThen check backend logs for SLOW_API_REQUEST, SLOW_PRISMA_QUERY, and PERFORMANCE_CHECKPOINT.\n`,
  };
}
