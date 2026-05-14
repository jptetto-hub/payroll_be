"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ||
    "7d");
exports.env = {
    port: process.env.PORT || 5000,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || "fallback-secret",
    jwtExpiresIn,
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
};
//# sourceMappingURL=env.js.map