export declare class SalaryHistoryRepository {
    static create(data: {
        employeeId: string;
        salaryAmount: number;
        effectiveFrom: Date;
    }): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findById(id: string): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<({
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            joiningDate: Date;
            salaryType: import(".prisma/client").$Enums.SalaryType;
            status: import(".prisma/client").$Enums.EmployeeStatus;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findEmployee(employeeId: string): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        name: string;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static listByEmployee(employeeId: string, pagination?: {
        skip: number;
        take: number;
    }): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }[]>;
    static countByEmployee(employeeId: string): import(".prisma/client").Prisma.PrismaPromise<number>;
    static findByEmployeeAndEffectiveDate(employeeId: string, effectiveFrom: Date): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
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
    static getCurrentSalary(employeeId: string): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
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
    static resolveSalaryByDate(employeeId: string, date: Date): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
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
    static update(id: string, data: {
        salaryAmount?: number;
        effectiveFrom?: Date;
    }): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static delete(id: string): import(".prisma/client").Prisma.Prisma__SalaryHistoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findPayrollUsingSalaryPeriod(employeeId: string, effectiveFrom: Date): import(".prisma/client").Prisma.Prisma__PayrollClient<{
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
}
//# sourceMappingURL=salary-history.repository.d.ts.map