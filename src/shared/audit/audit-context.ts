import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { Request } from "express";
import { normalizeAuditIpAddress } from "./audit-ip.util";

export interface AuditRequestMeta {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  requestId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
}

const auditContext = new AsyncLocalStorage<AuditRequestMeta>();

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getClientIp(req: Request) {
  return normalizeAuditIpAddress(
    firstHeaderValue(req.headers["cf-connecting-ip"]) ||
      firstHeaderValue(req.headers["x-real-ip"]) ||
      firstHeaderValue(req.headers["x-forwarded-for"]) ||
      req.ip ||
      req.socket.remoteAddress,
  );
}

function getDeviceInfo(userAgent?: string) {
  if (!userAgent) return undefined;

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Safari\//.test(userAgent)
        ? "Safari"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : "Unknown browser";

  const os = /Windows/i.test(userAgent)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(userAgent)
      ? "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(userAgent)
          ? "iOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
}

export function getAuditMeta(req: Request): AuditRequestMeta {
  const userAgent = firstHeaderValue(req.headers["user-agent"]);
  const requestId =
    firstHeaderValue(req.headers["x-request-id"]) ||
    firstHeaderValue(req.headers["x-correlation-id"]) ||
    randomUUID();
  const sessionId =
    firstHeaderValue(req.headers["x-session-id"]) ||
    firstHeaderValue(req.headers["x-client-session-id"]);

  const ipAddress = getClientIp(req);
  const deviceInfo = getDeviceInfo(userAgent);

  return {
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
    ...(deviceInfo !== undefined && { deviceInfo }),
    requestId,
    ...(sessionId !== undefined && { sessionId }),
    method: req.method,
    path: req.originalUrl || req.url,
  };
}

export function runWithAuditContext<T>(
  meta: AuditRequestMeta,
  callback: () => T,
) {
  return auditContext.run(meta, callback);
}

export function getCurrentAuditMeta() {
  return auditContext.getStore();
}
