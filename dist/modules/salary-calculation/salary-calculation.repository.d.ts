export declare class SalaryCalculationRepository {
    static findEmployee(employeeId: string): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        name: string;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static getSalaryHistories(employeeId: string, periodEnd: Date): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }[]>;
    static getAttendance(employeeId: string, periodStart: Date, periodEnd: Date): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    }[]>;
    static getAdvances(employeeId: string, periodStart: Date, periodEnd: Date): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: import("@prisma/client-runtime-utils").Decimal;
        isSettled: boolean;
        settledAmount: import("@prisma/client-runtime-utils").Decimal;
        carryForwardAmount: import("@prisma/client-runtime-utils").Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }[]>;
    static getAdvancesWithCancelledPayrollSnapshot(employeeId: string, periodStart: Date, periodEnd: Date): Promise<({
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: import("@prisma/client-runtime-utils").Decimal;
        isSettled: boolean;
        settledAmount: import("@prisma/client-runtime-utils").Decimal;
        carryForwardAmount: import("@prisma/client-runtime-utils").Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    } | {
        remainingAmount: number;
        settledAmount: number;
        carryForwardAmount: number;
        settlementStatus: any;
        isSettled: any;
        __restoreBeforeSettlement: boolean;
        __previousSettledAmount: number;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        note: string | null;
    })[]>;
}
//# sourceMappingURL=salary-calculation.repository.d.ts.map