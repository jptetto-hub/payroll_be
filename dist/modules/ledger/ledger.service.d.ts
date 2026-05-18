import { Role } from "@prisma/client";
export declare class LedgerService {
    static createAdvanceLedger(params: {
        employeeId: string;
        advanceId: string;
        amount: number;
        date: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: import("@prisma/client-runtime-utils").Decimal;
        credit: import("@prisma/client-runtime-utils").Decimal;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    static createPayrollLedger(params: {
        employeeId: string;
        payrollId: string;
        grossSalary: number;
        standardSalary?: number;
        otEarnings?: number;
        advanceDeduction: number;
        date: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: import("@prisma/client-runtime-utils").Decimal;
        credit: import("@prisma/client-runtime-utils").Decimal;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }[]>;
    static createAdjustmentLedger(params: {
        employeeId: string;
        payrollId: string;
        oldFinalSalary: number;
        newFinalSalary: number;
        date: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.LedgerType;
        date: Date;
        employeeId: string;
        payrollId: string | null;
        referenceId: string | null;
        debit: import("@prisma/client-runtime-utils").Decimal;
        credit: import("@prisma/client-runtime-utils").Decimal;
        balance: import("@prisma/client-runtime-utils").Decimal;
    } | null>;
    static list(query: any, authUser: {
        id: string;
        role: Role;
    }): Promise<{
        data: ({
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
            } | null;
        } & {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.LedgerType;
            date: Date;
            employeeId: string;
            payrollId: string | null;
            referenceId: string | null;
            debit: import("@prisma/client-runtime-utils").Decimal;
            credit: import("@prisma/client-runtime-utils").Decimal;
            balance: import("@prisma/client-runtime-utils").Decimal;
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static myLedger(employeeId: string, query: any): Promise<{
        data: ({
            payroll: {
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
            } | null;
        } & {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.LedgerType;
            date: Date;
            employeeId: string;
            payrollId: string | null;
            referenceId: string | null;
            debit: import("@prisma/client-runtime-utils").Decimal;
            credit: import("@prisma/client-runtime-utils").Decimal;
            balance: import("@prisma/client-runtime-utils").Decimal;
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static employeeLedger(employeeId: string, currentRole: Role, query: any): Promise<{
        data: ({
            payroll: {
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
            } | null;
        } & {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.LedgerType;
            date: Date;
            employeeId: string;
            payrollId: string | null;
            referenceId: string | null;
            debit: import("@prisma/client-runtime-utils").Decimal;
            credit: import("@prisma/client-runtime-utils").Decimal;
            balance: import("@prisma/client-runtime-utils").Decimal;
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static payrollLedger(payrollId: string, currentRole: Role, query: any): Promise<{
        data: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.LedgerType;
            date: Date;
            employeeId: string;
            payrollId: string | null;
            referenceId: string | null;
            debit: import("@prisma/client-runtime-utils").Decimal;
            credit: import("@prisma/client-runtime-utils").Decimal;
            balance: import("@prisma/client-runtime-utils").Decimal;
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
}
//# sourceMappingURL=ledger.service.d.ts.map