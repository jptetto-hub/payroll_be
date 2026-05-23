import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const schedulerStartErrors = new Rate('scheduler_start_errors');
export const schedulerStartDuration = new Trend('scheduler_start_duration_ms');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const SUPER_ADMIN_TOKEN = __ENV.SUPER_ADMIN_TOKEN;
const VUS = Number(__ENV.STRESS_VUS || 1);
const ITERATIONS = Number(__ENV.STRESS_ITERATIONS || 1);
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || 1000);
const POLL_STATUS = String(__ENV.POLL_STATUS || 'true').toLowerCase() === 'true';

export const options = {
  vus: VUS,
  iterations: ITERATIONS,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [`p(95)<${MAX_P95_MS}`],
    scheduler_start_errors: ['rate<0.01'],
    scheduler_start_duration_ms: [`p(95)<${MAX_P95_MS}`],
  },
};

function authHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${SUPER_ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
}

export default function () {
  if (!SUPER_ADMIN_TOKEN) {
    console.error('Missing SUPER_ADMIN_TOKEN');
    schedulerStartErrors.add(1);
    return;
  }

  const started = Date.now();
  const res = http.post(`${BASE_URL}/api/scheduler/run`, null, authHeaders());
  schedulerStartDuration.add(Date.now() - started);

  const ok = check(res, {
    'scheduler start returns 202': (r) => r.status === 202,
    'scheduler start has jobId': (r) => Boolean(r.json('jobId')),
    'scheduler start is successful': (r) => r.json('success') === true,
    'scheduler start status is queued/running': (r) => ['PENDING', 'RUNNING'].includes(r.json('status')),
  });

  schedulerStartErrors.add(!ok);

  const jobId = res.json('jobId');
  if (POLL_STATUS && jobId) {
    const statusRes = http.get(`${BASE_URL}/api/scheduler/runs/${jobId}`, authHeaders());
    check(statusRes, {
      'scheduler status returns 200': (r) => r.status === 200,
      'scheduler status id matches jobId': (r) => r.json('data.id') === jobId,
      'scheduler status has progress fields': (r) => r.json('data.processedEmployees') !== undefined,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  const p95 = data.metrics.scheduler_start_duration_ms?.percentiles?.['95'] || 'n/a';
  const failedRate = data.metrics.http_req_failed?.rate || 0;

  return {
    stdout: `\nScheduler start stress completed.\nRequests: ${data.metrics.http_reqs?.count || 0}\nFailed request rate: ${failedRate}\nScheduler start p95 ms: ${p95}\n\nIf scheduler start is slow, restart the API and worker with:\nENABLE_PRISMA_QUERY_LOG=true ENABLE_PERFORMANCE_LOG=true SLOW_QUERY_MS=200 SLOW_API_MS=500 npm run dev\nnpm run dev:worker\n\nThen check backend logs for SLOW_API_REQUEST, SLOW_PRISMA_QUERY, and PERFORMANCE_CHECKPOINT.\n`,
  };
}
