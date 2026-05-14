import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";

type AuthTokenPayload = JwtPayload & {
  id: string;
  phone: string;
  email?: string | null;
  role: Role;
};

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: token missing");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new Error("Unauthorized: token missing");
    }

    const decoded = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;

    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      email: decoded.email ?? null,
      role: decoded.role,
    };

    next();
  } catch {
    next(new Error("Unauthorized: invalid token"));
  }
};
