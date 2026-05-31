import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { redis } from "../../config/redis";

type SessionTokenPayload = {
  id: string;
  phone: string;
  email?: string | null;
  role: Role;
};

const sessionKey = (sessionId: string) => `auth:session:${sessionId}`;
const SESSION_REDIS_TIMEOUT_MS = Number(
  process.env.SESSION_REDIS_TIMEOUT_MS || 500,
);

const withRedisTimeout = <T>(promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutRef = setTimeout(
      () => reject(new Error("Session store operation timed out")),
      SESSION_REDIS_TIMEOUT_MS,
    );

    promise.then(
      (value) => {
        clearTimeout(timeoutRef);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutRef);
        reject(error);
      },
    );
  });

const parseCookies = (header?: string) => {
  const cookies = new Map<string, string>();

  for (const item of header?.split(";") ?? []) {
    const separatorIndex = item.indexOf("=");

    if (separatorIndex < 0) continue;

    const key = item.slice(0, separatorIndex).trim();
    const value = item.slice(separatorIndex + 1).trim();

    cookies.set(key, decodeURIComponent(value));
  }

  return cookies;
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: env.authIdleTimeoutSeconds * 1000,
});

export class AuthSessionService {
  static async create(payload: SessionTokenPayload) {
    const sessionId = randomUUID();
    const token = jwt.sign(
      {
        ...payload,
        sessionId,
      },
      env.jwtSecret,
      {
        expiresIn: env.jwtExpiresIn,
      },
    );

    await withRedisTimeout(
      redis.set(
        sessionKey(sessionId),
        payload.id,
        "EX",
        env.authIdleTimeoutSeconds,
      ),
    );

    return { sessionId, token };
  }

  static readToken(req: Request) {
    const cookieToken = parseCookies(req.headers.cookie).get(env.authCookieName);

    if (cookieToken) {
      return {
        token: cookieToken,
        source: "cookie" as const,
      };
    }

    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();

      if (token) {
        return {
          token,
          source: "bearer" as const,
        };
      }
    }

    return null;
  }

  static async isActive(sessionId: string, employeeId: string) {
    return (
      (await withRedisTimeout(redis.get(sessionKey(sessionId)))) === employeeId
    );
  }

  static async renew(
    sessionId: string,
    employeeId: string,
    options?: { alreadyValidated?: boolean },
  ) {
    if (
      !options?.alreadyValidated &&
      !(await this.isActive(sessionId, employeeId))
    ) {
      return false;
    }

    await withRedisTimeout(
      redis.expire(sessionKey(sessionId), env.authIdleTimeoutSeconds),
    );
    return true;
  }

  static async revoke(sessionId?: string) {
    if (sessionId) {
      await withRedisTimeout(redis.del(sessionKey(sessionId)));
    }
  }

  static async remainingSeconds(sessionId: string) {
    return Math.max(
      await withRedisTimeout(redis.ttl(sessionKey(sessionId))),
      0,
    );
  }

  static setCookie(res: Response, token: string) {
    res.cookie(env.authCookieName, token, cookieOptions());
  }

  static clearCookie(res: Response) {
    const { maxAge: _maxAge, ...options } = cookieOptions();
    res.clearCookie(env.authCookieName, options);
  }
}
