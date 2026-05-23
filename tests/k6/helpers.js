import http from "k6/http";
import { check } from "k6";

export const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export function login() {
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
    "login success": (r) => r.status === 200,
  });

  if (res.status !== 200 || !res.body) {
    console.error(
      `Login failed. status=${res.status} error=${res.error || ""} body=${res.body || ""}`,
    );
    throw new Error(
      "Login failed. Check BASE_URL, server status, ADMIN_PHONE, and ADMIN_PASSWORD.",
    );
  }

  let body;

  try {
    body = res.json();
  } catch (error) {
    console.error(`Login response is not JSON. status=${res.status} body=${res.body}`);
    throw error;
  }

  const token = body.token || body.data?.token;

  if (!token) {
    console.error(`Login response did not include token. body=${res.body}`);
    throw new Error("Login response did not include token");
  }

  return token;
}

export function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}
