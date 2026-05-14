import { z } from "zod";
import { WeekStartsOn } from "@prisma/client";

export const updateSettingsSchema = z.object({
  body: z.object({
    weekStartsOn: z.nativeEnum(WeekStartsOn).optional(),
    monthlyPayrollDay: z.number().int().min(1).max(31).nullable().optional(),
    autoPayrollEnabled: z.boolean().optional(),
  }),
});
