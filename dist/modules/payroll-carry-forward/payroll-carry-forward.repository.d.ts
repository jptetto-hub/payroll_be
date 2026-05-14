export declare class PayrollCarryForwardRepository {
    static findPendingByEmployee(employeeId: string, targetPeriodStart?: Date): import(".prisma/client").Prisma.PrismaPromise<{
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
    }[]>;
}
//# sourceMappingURL=payroll-carry-forward.repository.d.ts.map