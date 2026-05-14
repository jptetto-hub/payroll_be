import { WeekStartsOn } from "@prisma/client";
export declare const getWeeklyCycleEnd: (cycleStartDate: Date | string) => Date;
export declare const isValidWeeklyCycle: (periodStart: Date | string, periodEnd: Date | string, weekStartsOn: WeekStartsOn) => boolean;
export declare const validateWeeklyPayrollCycle: (periodStart: Date | string, periodEnd: Date | string, weekStartsOn: WeekStartsOn) => {
    periodStart: Date;
    periodEnd: Date;
};
//# sourceMappingURL=payrollCycle.utils.d.ts.map