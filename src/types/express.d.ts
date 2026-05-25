import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        phone: string;
        email?: string | null;
        role: Role;
      };
      authSession?: {
        id: string;
        token: string;
        source: "cookie" | "bearer";
      };
    }
  }
}

export {};
