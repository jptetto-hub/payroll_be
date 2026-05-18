export declare class SchedulerRepository {
    static getActiveEmployees(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        employeeCode: string;
        name: string;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
    }[]>;
    static getSystemSetting(): import(".prisma/client").Prisma.Prisma__SystemSettingClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        weekStartsOn: import(".prisma/client").$Enums.WeekStartsOn;
        monthlyPayrollDay: number | null;
        autoPayrollEnabled: boolean;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findPayroll(employeeId: string, periodStart: Date, periodEnd: Date): import(".prisma/client").Prisma.Prisma__PayrollClient<{
        id: string;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.PayrollStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        periodStart: Date;
        periodEnd: Date;
        grossSalary: import("@prisma/client-runtime-utils").Decimal;
        standardSalary: import("@prisma/client-runtime-utils").Decimal;
        otTotalHours: import("@prisma/client-runtime-utils").Decimal;
        otHourlyRate: import("@prisma/client-runtime-utils").Decimal;
        otEarnings: import("@prisma/client-runtime-utils").Decimal;
        advanceDeduction: import("@prisma/client-runtime-utils").Decimal;
        carryForwardApplied: import("@prisma/client-runtime-utils").Decimal;
        totalDeduction: import("@prisma/client-runtime-utils").Decimal;
        rawFinalSalary: import("@prisma/client-runtime-utils").Decimal;
        carryForwardDeduction: import("@prisma/client-runtime-utils").Decimal;
        finalSalary: import("@prisma/client-runtime-utils").Decimal;
        totalDays: number;
        workingDays: number;
        presentDays: import("@prisma/client-runtime-utils").Decimal;
        absentDays: import("@prisma/client-runtime-utils").Decimal;
        halfDays: import("@prisma/client-runtime-utils").Decimal;
        version: number;
        isRecalculated: boolean;
        recalculatedBy: string | null;
        recalculatedAt: Date | null;
        recalculationReason: string | null;
        replacedPayrollId: string | null;
        lockedAt: Date | null;
        cancelledAt: Date | null;
        cancelledById: string | null;
        cancelReason: string | null;
        salaryBreakdown: import("@prisma/client/runtime/client").JsonValue;
        attendanceBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        advanceBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        overtimeBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static getLatestPayroll(employeeId: string): import(".prisma/client").Prisma.Prisma__PayrollClient<{
        id: string;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.PayrollStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        periodStart: Date;
        periodEnd: Date;
        grossSalary: import("@prisma/client-runtime-utils").Decimal;
        standardSalary: import("@prisma/client-runtime-utils").Decimal;
        otTotalHours: import("@prisma/client-runtime-utils").Decimal;
        otHourlyRate: import("@prisma/client-runtime-utils").Decimal;
        otEarnings: import("@prisma/client-runtime-utils").Decimal;
        advanceDeduction: import("@prisma/client-runtime-utils").Decimal;
        carryForwardApplied: import("@prisma/client-runtime-utils").Decimal;
        totalDeduction: import("@prisma/client-runtime-utils").Decimal;
        rawFinalSalary: import("@prisma/client-runtime-utils").Decimal;
        carryForwardDeduction: import("@prisma/client-runtime-utils").Decimal;
        finalSalary: import("@prisma/client-runtime-utils").Decimal;
        totalDays: number;
        workingDays: number;
        presentDays: import("@prisma/client-runtime-utils").Decimal;
        absentDays: import("@prisma/client-runtime-utils").Decimal;
        halfDays: import("@prisma/client-runtime-utils").Decimal;
        version: number;
        isRecalculated: boolean;
        recalculatedBy: string | null;
        recalculatedAt: Date | null;
        recalculationReason: string | null;
        replacedPayrollId: string | null;
        lockedAt: Date | null;
        cancelledAt: Date | null;
        cancelledById: string | null;
        cancelReason: string | null;
        salaryBreakdown: import("@prisma/client/runtime/client").JsonValue;
        attendanceBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        advanceBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        overtimeBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static getFirstSalaryHistory(employeeId: string): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static createRun(data: {
        name: string;
        startedAt: Date;
        success: boolean;
        metadata?: any;
    }): import(".prisma/client").Prisma.Prisma__SchedulerRunClient<{
        id: string;
        name: string;
        createdAt: Date;
        success: boolean;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        startedAt: Date;
        finishedAt: Date | null;
        errorMessage: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static updateRun(id: string, data: {
        finishedAt: Date;
        success: boolean;
        errorMessage?: string;
        metadata?: any;
    }): import(".prisma/client").Prisma.Prisma__SchedulerRunClient<{
        id: string;
        name: string;
        createdAt: Date;
        success: boolean;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        startedAt: Date;
        finishedAt: Date | null;
        errorMessage: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static listRuns(params: {
        skip: number;
        take: number;
    }): Promise<[{
        id: string;
        name: string;
        createdAt: Date;
        success: boolean;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        startedAt: Date;
        finishedAt: Date | null;
        errorMessage: string | null;
    }[], number]>;
}
//# sourceMappingURL=scheduler.repository.d.ts.map