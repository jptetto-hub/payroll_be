"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSessionService = void 0;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
const sessionKey = (sessionId) => `auth:session:${sessionId}`;
const SESSION_REDIS_TIMEOUT_MS = Number(process.env.SESSION_REDIS_TIMEOUT_MS || 500);
const withRedisTimeout = (promise) => new Promise((resolve, reject) => {
    const timeoutRef = setTimeout(() => reject(new Error("Session store operation timed out")), SESSION_REDIS_TIMEOUT_MS);
    promise.then((value) => {
        clearTimeout(timeoutRef);
        resolve(value);
    }, (error) => {
        clearTimeout(timeoutRef);
        reject(error);
    });
});
const parseCookies = (header) => {
    const cookies = new Map();
    for (const item of header?.split(";") ?? []) {
        const separatorIndex = item.indexOf("=");
        if (separatorIndex < 0)
            continue;
        const key = item.slice(0, separatorIndex).trim();
        const value = item.slice(separatorIndex + 1).trim();
        cookies.set(key, decodeURIComponent(value));
    }
    return cookies;
};
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: env_1.env.authIdleTimeoutSeconds * 1000,
});
class AuthSessionService {
    static async create(payload) {
        const sessionId = (0, crypto_1.randomUUID)();
        const token = jsonwebtoken_1.default.sign({
            ...payload,
            sessionId,
        }, env_1.env.jwtSecret, {
            expiresIn: env_1.env.jwtExpiresIn,
        });
        await withRedisTimeout(redis_1.redis.set(sessionKey(sessionId), payload.id, "EX", env_1.env.authIdleTimeoutSeconds));
        return { sessionId, token };
    }
    static readToken(req) {
        const cookieToken = parseCookies(req.headers.cookie).get(env_1.env.authCookieName);
        if (cookieToken) {
            return {
                token: cookieToken,
                source: "cookie",
            };
        }
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice("Bearer ".length).trim();
            if (token) {
                return {
                    token,
                    source: "bearer",
                };
            }
        }
        return null;
    }
    static async isActive(sessionId, employeeId) {
        return ((await withRedisTimeout(redis_1.redis.get(sessionKey(sessionId)))) === employeeId);
    }
    static async renew(sessionId, employeeId, options) {
        if (!options?.alreadyValidated &&
            !(await this.isActive(sessionId, employeeId))) {
            return false;
        }
        await withRedisTimeout(redis_1.redis.expire(sessionKey(sessionId), env_1.env.authIdleTimeoutSeconds));
        return true;
    }
    static async revoke(sessionId) {
        if (sessionId) {
            await withRedisTimeout(redis_1.redis.del(sessionKey(sessionId)));
        }
    }
    static async remainingSeconds(sessionId) {
        return Math.max(await withRedisTimeout(redis_1.redis.ttl(sessionKey(sessionId))), 0);
    }
    static setCookie(res, token) {
        res.cookie(env_1.env.authCookieName, token, cookieOptions());
    }
    static clearCookie(res) {
        const { maxAge: _maxAge, ...options } = cookieOptions();
        res.clearCookie(env_1.env.authCookieName, options);
    }
}
exports.AuthSessionService = AuthSessionService;
//# sourceMappingURL=auth-session.service.js.map