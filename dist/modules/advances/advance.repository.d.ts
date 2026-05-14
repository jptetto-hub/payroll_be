import { Prisma, SalaryType } from "@prisma/client";
export declare class AdvanceRepository {
    static findEmployee(employeeId: string): Prisma.Prisma__EmployeeClient<{
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
    static getSystemSetting(): Prisma.Prisma__SystemSettingClient<{
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
    static create(data: {
        employeeId: string;
        amount: number;
        date: Date;
        payCycleType: SalaryType;
        cycleStartDate: Date;
        cycleEndDate: Date;
        remainingAmount: number;
        isSettled: boolean;
        note?: string;
    }): Prisma.Prisma__AdvancePaymentClient<{
        employee: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            designation: string | null;
            department: string | null;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findById(id: string): Prisma.Prisma__AdvancePaymentClient<({
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            joiningDate: Date;
            salaryType: import(".prisma/client").$Enums.SalaryType;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static listAll(params: {
        skip: number;
        take: number;
        employeeWhere?: Prisma.EmployeeWhereInput;
        isSettled?: boolean;
    }): Promise<[({
        employee: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            designation: string | null;
            department: string | null;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    })[], number]>;
    static listByEmployee(employeeId: string, pagination?: {
        skip: number;
        take: number;
    }): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }[]>;
    static countByEmployee(employeeId: string): Prisma.PrismaPromise<number>;
    static listByCycle(employeeId: string, cycleStartDate: Date, cycleEndDate: Date): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }[]>;
    static findPayrollForCycle(employeeId: string, cycleStartDate: Date, cycleEndDate: Date): Prisma.Prisma__PayrollClient<{
        id: string;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.PayrollStatus;
        createdAt: Date;
        updatedAt: Date;
        employeeId: string;
        periodStart: Date;
        periodEnd: Date;
        grossSalary: Prisma.Decimal;
        advanceDeduction: Prisma.Decimal;
        carryForwardApplied: Prisma.Decimal;
        totalDeduction: Prisma.Decimal;
        rawFinalSalary: Prisma.Decimal;
        carryForwardDeduction: Prisma.Decimal;
        finalSalary: Prisma.Decimal;
        totalDays: number;
        workingDays: number;
        presentDays: Prisma.Decimal;
        absentDays: Prisma.Decimal;
        halfDays: Prisma.Decimal;
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
        salaryBreakdown: Prisma.JsonValue;
        attendanceBreakdown: Prisma.JsonValue | null;
        advanceBreakdown: Prisma.JsonValue | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static update(id: string, data: {
        amount?: number;
        remainingAmount?: number;
        date?: Date;
        cycleStartDate?: Date;
        cycleEndDate?: Date;
        note?: string;
    }): Prisma.Prisma__AdvancePaymentClient<{
        employee: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            designation: string | null;
            department: string | null;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static delete(id: string): Prisma.Prisma__AdvancePaymentClient<{
        employee: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            designation: string | null;
            department: string | null;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static getSalaryForDate(employeeId: string, date: Date): Prisma.Prisma__SalaryHistoryClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: Prisma.Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static getAdvancesForCycle(employeeId: string, cycleStartDate: Date, cycleEndDate: Date, excludeAdvanceId?: string): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }[]>;
    static getUnsettledAdvancesForCycle(employeeId: string, cycleStartDate: Date, cycleEndDate: Date): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        cycleStartDate: Date;
        cycleEndDate: Date;
        lockedByPayrollId: string | null;
        amount: Prisma.Decimal;
        payCycleType: import(".prisma/client").$Enums.SalaryType;
        remainingAmount: Prisma.Decimal;
        isSettled: boolean;
        settledAmount: Prisma.Decimal;
        carryForwardAmount: Prisma.Decimal;
        settlementStatus: import(".prisma/client").$Enums.AdvanceSettlementStatus;
        note: string | null;
    }[]>;
    static settleAdvances(ids: string[]): Promise<{
        count: number;
    }>;
}
//# sourceMappingURL=advance.repository.d.ts.map