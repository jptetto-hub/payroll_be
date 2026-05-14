import { Prisma, Role } from "@prisma/client";
export declare class AdvanceService {
    static createAdvance(data: {
        employeeId: string;
        amount: number;
        date: string;
        deductionCycleStartDate: string;
        note?: string;
    }, currentUserRole: Role): Promise<{
        advance: {
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
        };
        ledgerEntry: {
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
        };
    }>;
    static listAdvances(query: any, authUser: {
        id: string;
        role: Role;
    }): Promise<{
        data: ({
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
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static myAdvances(employeeId: string, query: any): Promise<{
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
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static getAdvanceById(id: string, currentUser: {
        id: string;
        role: Role;
    }): Promise<{
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
    }>;
    static listByEmployee(employeeId: string, currentUserRole: Role, query: any): Promise<{
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
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static listByCycle(employeeId: string, cycleStartDateValue: string, cycleEndDateValue: string, currentUserRole: Role): Promise<{
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
    static updateAdvance(id: string, data: {
        amount?: number;
        date?: string;
        deductionCycleStartDate?: string;
        note?: string;
        reason: string;
    }, currentUserRole: Role): Promise<{
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
    }>;
    static deleteAdvance(id: string, currentUserRole: Role, reason: string): Promise<{
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
    }>;
}
//# sourceMappingURL=advance.service.d.ts.map