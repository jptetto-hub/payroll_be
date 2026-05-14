import dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";

dotenv.config();

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ||
  "7d") as NonNullable<SignOptions["expiresIn"]>;

export const env = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "fallback-secret",
  jwtExpiresIn,
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
};
