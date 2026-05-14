import { Prisma } from "@prisma/client";
type ReportParams = {
    employeeWhere: Prisma.EmployeeWhereInput;
    fromDate?: Date | undefined;
    toDate?: Date | undefined;
    page: number;
    limit: number;
    skip: number;
    take: number;
    paginate?: boolean;
};
export declare class ReportsRepository {
    static salaryReport(params: ReportParams): Promise<{
        data: {
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
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static attendanceReport(params: ReportParams): Promise<{
        data: {
            id: string;
            status: import(".prisma/client").$Enums.AttendanceStatus;
            createdAt: Date;
            updatedAt: Date;
            date: Date;
            employeeId: string;
            lockedByPayrollId: string | null;
        }[];
        summary: {
            totalRecords: number;
            present: number;
            absent: number;
            halfDay: number;
        };
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static advanceReport(params: ReportParams): Promise<{
        data: {
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
        }[];
        summary: {
            totalAdvanceAmount: number;
            totalRemainingAmount: number;
            totalSettledAmount: number;
            totalCarryForwardAmount: number;
            settledCount: number;
            unsettledCount: number;
        };
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static allInOneReport(params: ReportParams): Promise<{
        data: {
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
        }[];
        summary: {
            totalEmployees: number;
            totalPayrollRecords: number;
            totalGrossSalary: number;
            totalAdvanceDeduction: number;
            totalCarryForwardApplied: number;
            totalDeduction: number;
            totalRawFinalSalary: number;
            totalFinalSalary: number;
            totalCarryForwardDeduction: number;
        };
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
}
export {};
//# sourceMappingURL=reports.repository.d.ts.map