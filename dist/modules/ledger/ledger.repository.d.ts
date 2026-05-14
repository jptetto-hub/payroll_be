import { LedgerType, Prisma } from "@prisma/client";
export declare class LedgerRepository {
    static getLastBalance(employeeId: string): Promise<number>;
    static create(data: {
        employeeId: string;
        payrollId?: string;
        type: LedgerType;
        referenceId?: string;
        debit?: number;
        credit?: number;
        balance: number;
        date: Date;
    }): Prisma.Prisma__LedgerEntryClient<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        balance: Prisma.Decimal;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static listAll(params: {
        skip: number;
        take: number;
        employeeWhere?: Prisma.EmployeeWhereInput;
        payrollId?: string;
        type?: LedgerType;
    }): Promise<[({
        employee: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
        payroll: {
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
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        balance: Prisma.Decimal;
    })[], number]>;
    static listByEmployee(employeeId: string, pagination?: {
        skip: number;
        take: number;
    }): Prisma.PrismaPromise<({
        payroll: {
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
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        balance: Prisma.Decimal;
    })[]>;
    static countByEmployee(employeeId: string): Prisma.PrismaPromise<number>;
    static listByPayroll(payrollId: string, pagination?: {
        skip: number;
        take: number;
    }): Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        balance: Prisma.Decimal;
    }[]>;
    static countByPayroll(payrollId: string): Prisma.PrismaPromise<number>;
    static findEmployee(employeeId: string): Prisma.Prisma__EmployeeClient<{
        id: string;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findPayroll(payrollId: string): Prisma.Prisma__PayrollClient<({
        employee: {
            id: string;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
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
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
}
//# sourceMappingURL=ledger.repository.d.ts.map