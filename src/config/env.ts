import dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";

dotenv.config();

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ||
  "7d") as NonNullable<SignOptions["expiresIn"]>;

export const env = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  readDatabaseUrl: process.env.READ_DATABASE_URL || process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret",
  jwtExpiresIn,
  authCookieName: process.env.AUTH_COOKIE_NAME || "payroll_session",
  authIdleTimeoutSeconds: Number(process.env.AUTH_IDLE_TIMEOUT_SECONDS || 1800),
  bcryptSaltRounds: Number(
    process.env.BCRYPT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || 10,
  ),
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisUrl: process.env.REDIS_URL || undefined,
};
