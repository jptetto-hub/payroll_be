"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const auth_session_service_1 = require("../modules/auth/auth-session.service");
const authMiddleware = async (req, res, next) => {
    try {
        const sessionToken = auth_session_service_1.AuthSessionService.readToken(req);
        if (!sessionToken) {
            throw new Error("Unauthorized: token missing");
        }
        const decoded = jsonwebtoken_1.default.verify(sessionToken.token, env_1.env.jwtSecret);
        if (!decoded.sessionId ||
            !(await auth_session_service_1.AuthSessionService.isActive(decoded.sessionId, decoded.id))) {
            auth_session_service_1.AuthSessionService.clearCookie(res);
            throw new Error("Unauthorized: session expired due to inactivity");
        }
        req.user = {
            id: decoded.id,
            phone: decoded.phone,
            email: decoded.email ?? null,
            role: decoded.role,
        };
        req.authSession = {
            id: decoded.sessionId,
            token: sessionToken.token,
            source: sessionToken.source,
        };
        // Existing bearer-token integrations represent active API clients. The
        // browser uses its explicit interaction heartbeat instead.
        if (sessionToken.source === "bearer") {
            await auth_session_service_1.AuthSessionService.renew(decoded.sessionId, decoded.id, {
                alreadyValidated: true,
            });
        }
        next();
    }
    catch (error) {
        auth_session_service_1.AuthSessionService.clearCookie(res);
        next(error instanceof Error && error.message.startsWith("Unauthorized:")
            ? error
            : new Error("Unauthorized: invalid or expired session"));
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map