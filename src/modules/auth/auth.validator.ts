import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Valid 10-digit Indian phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});
