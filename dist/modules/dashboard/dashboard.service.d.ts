export declare class DashboardService {
    static summary(query: any, user: any): Promise<{
        employees: {
            total: number;
            active: number;
            inactive: number;
            weekly: number;
            monthly: number;
        };
        payroll: {
            generated: number;
            paid: number;
            cancelled: number;
            superseded: number;
            totalSalary: number;
            otTotalHours: number;
            otEarnings: number;
            totalDeductions: number;
            carryForwardBalance: number;
        };
        advances: {
            settled: number;
            unsettled: number;
            partiallySettled: number;
            totalAdvanceAmount: number;
            remainingAmount: number;
        };
        attendance: {
            present: number;
            absent: number;
            halfDay: number;
            missing: number;
        };
        approvals: {
            pending: number;
            approved: number;
            rejected: number;
        };
    }>;
    static recentPayroll(query: any, user: any): Promise<{
        data: {
            payrollId: string;
            employeeId: string;
            employeeCode: string;
            employeeName: string;
            salaryType: import(".prisma/client").$Enums.SalaryType;
            periodStart: string;
            periodEnd: string;
            finalSalary: number;
            status: import(".prisma/client").$Enums.PayrollStatus;
            createdAt: Date;
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static recentActivities(query: any, user: any): Promise<{
        data: ({
            summary: string;
            status: import(".prisma/client").$Enums.PayrollStatus;
            timestamp: Date;
            employeeId: any;
            employeeCode: any;
            employeeName: any;
            id: string;
            module: string;
            action: string;
        } | {
            summary: string;
            status: import(".prisma/client").$Enums.AttendanceStatus;
            timestamp: Date;
            employeeId: any;
            employeeCode: any;
            employeeName: any;
            id: string;
            module: string;
            action: string;
        } | {
            summary: string;
            status: import(".prisma/client").$Enums.AdvanceSettlementStatus;
            timestamp: Date;
            employeeId: any;
            employeeCode: any;
            employeeName: any;
            id: string;
            module: string;
            action: string;
        } | {
            summary: string;
            status: import(".prisma/client").$Enums.RequestStatus;
            timestamp: Date;
            employeeId: any;
            employeeCode: any;
            employeeName: any;
            id: string;
            module: string;
            action: import(".prisma/client").$Enums.RequestStatus;
        } | {
            summary: string;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            timestamp: Date;
            employeeId: any;
            employeeCode: any;
            employeeName: any;
            id: string;
            module: string;
            action: string;
        } | {
            id: string;
            module: string;
            action: import(".prisma/client").$Enums.AuditAction;
            employeeId: string | null;
            employeeCode: string | null;
            employeeName: string | null;
            summary: string;
            status: import(".prisma/client").$Enums.AuditAction;
            timestamp: Date;
        } | {
            summary: string;
            status: import(".prisma/client").$Enums.LedgerType;
            timestamp: Date;
            employeeId: any;
            employeeCode: any;
            employeeName: any;
            id: string;
            module: string;
            action: import(".prisma/client").$Enums.LedgerType;
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static analytics(query: any, user: any): Promise<{
        payrollTrend: any[];
        attendanceTrend: any[];
        advanceTrend: any[];
        payrollStatusComparison: {
            generated: number;
            paid: number;
            cancelled: number;
            superseded: number;
        };
    }>;
}
//# sourceMappingURL=dashboard.service.d.ts.map