import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const errorRate = new Rate('errors');
export const apiDuration = new Trend('api_duration_ms');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || __ENV.SUPER_ADMIN_TOKEN;
const USER_TOKEN = __ENV.USER_TOKEN;
const EMPLOYEE_ID = __ENV.EMPLOYEE_ID || __ENV.WEEKLY_EMPLOYEE_ID;
const PAYROLL_ID = __ENV.PAYROLL_ID || __ENV.WEEKLY_PAYROLL_ID;

const VUS = Number(__ENV.STRESS_VUS || 10);
const DURATION = __ENV.STRESS_DURATION || '30s';
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || 1500);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: [`p(95)<${MAX_P95_MS}`],
    errors: ['rate<0.05'],
  },
};

function headers(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

function hit(label, method, url, token, body = null) {
  if (!token) {
    console.warn(`Skipping ${label}: missing token`);
    return;
  }

  const params = headers(token);
  const started = Date.now();
  const res = method === 'POST'
    ? http.post(url, body ? JSON.stringify(body) : null, params)
    : http.get(url, params);

  apiDuration.add(Date.now() - started, { label });

  const ok = check(res, {
    [`${label}: status is not 500`]: (r) => r.status < 500,
    [`${label}: status is not timeout/0`]: (r) => r.status !== 0,
  });

  errorRate.add(!ok || res.status >= 500, { label });

  if (res.status >= 500 || res.status === 0) {
    console.error(`${label} failed with status ${res.status}: ${res.body}`);
  }
}

export default function () {
  hit('admin employees list', 'GET', `${BASE_URL}/api/employees?page=1&limit=20`, ADMIN_TOKEN);
  hit('admin attendance list', 'GET', `${BASE_URL}/api/attendance?page=1&limit=20`, ADMIN_TOKEN);
  hit('admin advances list', 'GET', `${BASE_URL}/api/advances?page=1&limit=20`, ADMIN_TOKEN);
  hit('admin payroll list', 'GET', `${BASE_URL}/api/payroll?page=1&limit=20`, ADMIN_TOKEN);
  hit('admin payslips list', 'GET', `${BASE_URL}/api/payslips?page=1&limit=20`, ADMIN_TOKEN);
  hit('admin ledger list', 'GET', `${BASE_URL}/api/ledger?page=1&limit=20`, ADMIN_TOKEN);

  if (EMPLOYEE_ID) {
    hit('salary preview read calculation', 'POST', `${BASE_URL}/api/salary-calculation/preview`, ADMIN_TOKEN, {
      employeeId: EMPLOYEE_ID,
      periodStart: __ENV.PERIOD_START || '2026-04-27',
      periodEnd: __ENV.PERIOD_END || '2026-05-02',
      salaryType: __ENV.SALARY_TYPE || 'WEEKLY',
    });
  }

  if (PAYROLL_ID) {
    hit('payroll by id', 'GET', `${BASE_URL}/api/payroll/${PAYROLL_ID}`, ADMIN_TOKEN);
    hit('payslip by payroll', 'GET', `${BASE_URL}/api/payslips/payroll/${PAYROLL_ID}`, ADMIN_TOKEN);
    hit('ledger by payroll', 'GET', `${BASE_URL}/api/ledger/payroll/${PAYROLL_ID}`, ADMIN_TOKEN);
  }

  if (USER_TOKEN) {
    hit('user my attendance requests', 'GET', `${BASE_URL}/api/attendance-requests/my`, USER_TOKEN);
    hit('user my payslips', 'GET', `${BASE_URL}/api/payslips/my`, USER_TOKEN);
    hit('user my ledger', 'GET', `${BASE_URL}/api/ledger/my`, USER_TOKEN);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: `\nStress test completed.\nRequests: ${data.metrics.http_reqs?.count || 0}\nFailed request rate: ${data.metrics.http_req_failed?.rate || 0}\nP95 duration ms: ${data.metrics.http_req_duration?.percentiles?.['95'] || 'n/a'}\n`,
  };
}
