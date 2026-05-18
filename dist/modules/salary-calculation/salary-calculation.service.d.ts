export declare class SalaryCalculationService {
    static preview(data: {
        employeeId: string;
        periodStart: string;
        periodEnd: string;
    }): Promise<{
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
        period: {
            periodStart: string;
            periodEnd: string;
            effectivePeriodStart: string;
            effectivePeriodEnd: string;
            joinedDuringCycle: boolean;
        };
        attendanceSummary: {
            workingDays: number;
            presentDays: number;
            halfDays: number;
            absentDays: number;
            missingDays: number;
            attendedDays: number;
            otTotalHours: number;
            otEarnings: number;
            effectivePeriodStart: any;
            effectivePeriodEnd: any;
            joinedDuringCycle: boolean;
        };
        salaryBreakdown: any[];
        advanceSummary: {
            advances: any;
            advanceDeduction: number;
        };
        carryForwardSummary: {
            pendingCarryForwards: never[];
            appliedCarryForwards: any;
            carryForwardApplied: number;
        };
        overtimeSummary: {
            otTotalHours: number;
            otHourlyRate: number;
            otEarnings: number;
            segments: any;
        };
        result: {
            standardSalary: number;
            grossSalary: number;
            otTotalHours: number;
            otHourlyRate: number;
            otEarnings: number;
            advanceDeduction: number;
            carryForwardApplied: number;
            totalDeduction: number;
            rawFinalSalary: number;
            finalSalary: number;
            carryForwardDeduction: number;
            hasCarryForward: boolean;
            isNegativeSalary: boolean;
        };
    } | {
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
        period: {
            periodStart: string;
            periodEnd: string;
            effectivePeriodStart: string;
            effectivePeriodEnd: string;
            joinedDuringCycle: boolean;
        };
        attendanceSummary: {
            workingDays: number;
            presentDays: number;
            halfDays: number;
            absentDays: number;
            missingDays: number;
            attendedDays: number;
            otTotalHours: number;
            otEarnings: number;
            effectivePeriodStart: string;
            effectivePeriodEnd: string;
            joinedDuringCycle: boolean;
        };
        salaryBreakdown: {
            salaryHistoryId: string;
            salaryAmount: number;
            segmentStart: string;
            segmentEnd: string;
            workingDays: number;
            presentDays: number;
            halfDays: number;
            absentDays: number;
            missingDays: number;
            attendedDays: number;
            perDaySalary: number;
            standardSalary: number;
            otHours: number;
            otHourlyRate: number;
            otEarnings: number;
            grossSalary: number;
        }[];
        advanceSummary: {
            advances: ({
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
            })[];
            advanceDeduction: number;
        };
        carryForwardSummary: {
            pendingCarryForwards: {
                id: string;
                status: import(".prisma/client").$Enums.CarryForwardStatus;
                createdAt: Date;
                updatedAt: Date;
                employeeId: string;
                cycleStartDate: Date;
                cycleEndDate: Date;
                amount: import("@prisma/client-runtime-utils").Decimal;
                remainingAmount: import("@prisma/client-runtime-utils").Decimal;
                sourcePayrollId: string;
            }[];
            appliedCarryForwards: {
                id: string;
                amount: number;
                remainingAmount: number;
                appliedAmount: number;
                previousStatus: import(".prisma/client").$Enums.CarryForwardStatus;
            }[];
            carryForwardApplied: number;
        };
        overtimeSummary: {
            otTotalHours: number;
            otHourlyRate: number;
            otEarnings: number;
            segments: {
                salaryHistoryId: string;
                segmentStart: string;
                segmentEnd: string;
                otHours: number;
                otHourlyRate: number;
                otEarnings: number;
            }[];
        };
        result: {
            standardSalary: number;
            grossSalary: number;
            otTotalHours: number;
            otHourlyRate: number;
            otEarnings: number;
            advanceDeduction: number;
            carryForwardApplied: number;
            totalDeduction: number;
            rawFinalSalary: number;
            finalSalary: number;
            carryForwardDeduction: number;
            hasCarryForward: boolean;
            isNegativeSalary: boolean;
        };
    }>;
}
//# sourceMappingURL=salary-calculation.service.d.ts.map