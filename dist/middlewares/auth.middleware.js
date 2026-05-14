"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const authMiddleware = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("Unauthorized: token missing");
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            throw new Error("Unauthorized: token missing");
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        req.user = {
            id: decoded.id,
            phone: decoded.phone,
            email: decoded.email ?? null,
            role: decoded.role,
        };
        next();
    }
    catch {
        next(new Error("Unauthorized: invalid token"));
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map