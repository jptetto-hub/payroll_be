import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AuthSessionService } from "../modules/auth/auth-session.service";

type AuthTokenPayload = JwtPayload & {
  id: string;
  phone: string;
  email?: string | null;
  role: Role;
  sessionId: string;
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionToken = AuthSessionService.readToken(req);

    if (!sessionToken) {
      throw new Error("Unauthorized: token missing");
    }

    const decoded = jwt.verify(sessionToken.token, env.jwtSecret) as AuthTokenPayload;

    if (
      !decoded.sessionId ||
      !(await AuthSessionService.isActive(decoded.sessionId, decoded.id))
    ) {
      AuthSessionService.clearCookie(res);
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
      await AuthSessionService.renew(decoded.sessionId, decoded.id, {
        alreadyValidated: true,
      });
    }

    next();
  } catch (error) {
    AuthSessionService.clearCookie(res);
    next(
      error instanceof Error && error.message.startsWith("Unauthorized:")
        ? error
        : new Error("Unauthorized: invalid or expired session"),
    );
  }
};
