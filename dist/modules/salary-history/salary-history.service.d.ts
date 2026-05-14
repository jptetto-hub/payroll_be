import { Role } from "@prisma/client";
export declare class SalaryHistoryService {
    private static ensureAllowedReadAccess;
    static createSalaryHistory(data: {
        employeeId: string;
        salaryAmount: number;
        effectiveFrom: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }>;
    static listSalaryHistory(employeeId: string, currentUserRole: Role, currentUserId: string, query: any): Promise<{
        data: {
            employee: {
                id: string;
                employeeCode: string;
                name: string;
                joiningDate: Date;
                salaryType: import(".prisma/client").$Enums.SalaryType;
                status: import(".prisma/client").$Enums.EmployeeStatus;
            };
            histories: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                salaryAmount: import("@prisma/client-runtime-utils").Decimal;
                effectiveFrom: Date;
                lockedFromPayrollId: string | null;
                employeeId: string;
            }[];
        };
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static getCurrentSalary(employeeId: string, currentUserRole: Role, currentUserId: string): Promise<{
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            joiningDate: Date;
            salaryType: import(".prisma/client").$Enums.SalaryType;
            status: import(".prisma/client").$Enums.EmployeeStatus;
        };
        salary: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            salaryAmount: import("@prisma/client-runtime-utils").Decimal;
            effectiveFrom: Date;
            lockedFromPayrollId: string | null;
            employeeId: string;
        } | null;
    }>;
    static resolveSalary(employeeId: string, date: string, currentUserRole: Role, currentUserId: string): Promise<{
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            joiningDate: Date;
            salaryType: import(".prisma/client").$Enums.SalaryType;
            status: import(".prisma/client").$Enums.EmployeeStatus;
        };
        targetDate: Date;
        salary: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            salaryAmount: import("@prisma/client-runtime-utils").Decimal;
            effectiveFrom: Date;
            lockedFromPayrollId: string | null;
            employeeId: string;
        };
    }>;
    static updateSalaryHistory(id: string, data: {
        salaryAmount?: number;
        effectiveFrom?: string;
        correctionReason: string;
    }, currentUserRole: Role): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }>;
    static deleteSalaryHistory(id: string, currentUserRole: Role, reason?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        salaryAmount: import("@prisma/client-runtime-utils").Decimal;
        effectiveFrom: Date;
        lockedFromPayrollId: string | null;
        employeeId: string;
    }>;
}
//# sourceMappingURL=salary-history.service.d.ts.map