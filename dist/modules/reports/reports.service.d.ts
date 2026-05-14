export declare class ReportsService {
    static salary(query: any, authUser: any): Promise<{
        data: {
            id: string;
            salaryType: import(".prisma/client").$Enums.SalaryType;
            status: import(".prisma/client").$Enums.PayrollStatus;
            createdAt: Date;
            updatedAt: Date;
            employeeId: string;
            periodStart: Date;
            periodEnd: Date;
            grossSalary: import("@prisma/client-runtime-utils").Decimal;
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
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static salaryExport(query: any, authUser: any): Promise<string>;
    static attendance(query: any, authUser: any): Promise<{
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
    static attendanceExport(query: any, authUser: any): Promise<string>;
    static advance(query: any, authUser: any): Promise<{
        data: {
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
    static advanceExport(query: any, authUser: any): Promise<string>;
    static salaryExportExcel(query: any, authUser: any): Promise<import("exceljs").Buffer>;
    static attendanceExportExcel(query: any, authUser: any): Promise<import("exceljs").Buffer>;
    static advanceExportExcel(query: any, authUser: any): Promise<import("exceljs").Buffer>;
    static allInOne(query: any, authUser: any): Promise<{
        data: {
            employeeCode: any;
            name: any;
            salaryType: any;
            periodStart: string;
            periodEnd: string;
            grossSalary: number;
            advanceDeduction: number;
            carryForwardApplied: number;
            totalDeduction: number;
            rawFinalSalary: number;
            finalSalary: number;
            carryForwardDeduction: number;
            payrollStatus: any;
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
    static allInOneExport(query: any, authUser: any): Promise<string>;
    static allInOneExportExcel(query: any, authUser: any): Promise<import("exceljs").Buffer>;
}
//# sourceMappingURL=reports.service.d.ts.map