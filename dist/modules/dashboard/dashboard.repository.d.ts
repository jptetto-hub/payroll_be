import { Prisma } from "@prisma/client";
type DateRange = {
    from?: Date | undefined;
    to?: Date | undefined;
};
export declare class DashboardRepository {
    static employeeSummary(employeeWhere: Prisma.EmployeeWhereInput): Promise<[number, number, number, number, number]>;
    static payrollSummary(employeeWhere: Prisma.EmployeeWhereInput, range: DateRange): Promise<[(Prisma.PickEnumerable<Prisma.PayrollGroupByOutputType, "status"[]> & {
        _count: number;
    })[], Prisma.GetPayrollAggregateType<{
        where: {
            periodStart?: {
                gte?: Date;
            };
            periodEnd?: {
                lte?: Date;
            };
            employee: Prisma.EmployeeWhereInput;
        };
        _sum: {
            finalSalary: true;
            totalDeduction: true;
            advanceDeduction: true;
        };
    }>, Prisma.GetPayrollCarryForwardAggregateType<{
        where: {
            employee: Prisma.EmployeeWhereInput;
            status: {
                in: ("PENDING" | "PARTIALLY_DEDUCTED")[];
            };
        };
        _sum: {
            remainingAmount: true;
        };
    }>, {
        attendanceBreakdown: Prisma.JsonValue;
    }[]]>;
    static advanceSummary(employeeWhere: Prisma.EmployeeWhereInput, range: DateRange): Promise<[number, number, number, Prisma.GetAdvancePaymentAggregateType<{
        where: {
            date?: {
                lte?: Date;
                gte?: Date;
            };
            employee: Prisma.EmployeeWhereInput;
        };
        _sum: {
            amount: true;
            remainingAmount: true;
        };
    }>]>;
    static attendanceSummary(employeeWhere: Prisma.EmployeeWhereInput, range: DateRange): Prisma.GetAttendanceGroupByPayload<{
        by: "status"[];
        where: {
            date?: {
                lte?: Date;
                gte?: Date;
            };
            employee: Prisma.EmployeeWhereInput;
        };
        _count: true;
    }>;
    static approvalSummary(employeeWhere: Prisma.EmployeeWhereInput, range: DateRange): Prisma.GetAttendanceRequestGroupByPayload<{
        by: "status"[];
        where: {
            attendanceDate?: {
                lte?: Date;
                gte?: Date;
            };
            employee: Prisma.EmployeeWhereInput;
        };
        _count: true;
    }>;
    static recentPayroll(params: {
        skip: number;
        take: number;
        employeeWhere: Prisma.EmployeeWhereInput;
        range: DateRange;
        search?: string;
    }): Promise<[({
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            salaryType: import(".prisma/client").$Enums.SalaryType;
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
    })[], number]>;
    static recentActivities(params: {
        employeeWhere: Prisma.EmployeeWhereInput;
        take: number;
    }): Promise<{
        records: {
            payroll: ({
                employee: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
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
            })[];
            attendance: ({
                employee: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                };
            } & {
                id: string;
                status: import(".prisma/client").$Enums.AttendanceStatus;
                createdAt: Date;
                updatedAt: Date;
                date: Date;
                employeeId: string;
                lockedByPayrollId: string | null;
            })[];
            advances: ({
                employee: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
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
            requests: ({
                employee: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                };
            } & {
                id: string;
                status: import(".prisma/client").$Enums.RequestStatus;
                createdAt: Date;
                updatedAt: Date;
                employeeId: string;
                attendanceDate: Date;
                oldStatus: import(".prisma/client").$Enums.AttendanceStatus | null;
                requestedStatus: import(".prisma/client").$Enums.AttendanceStatus;
                requestType: import(".prisma/client").$Enums.AttendanceRequestType;
                reason: string | null;
                requestedById: string;
                approvedById: string | null;
                approvedAt: Date | null;
                rejectionReason: string | null;
            })[];
            salaryHistory: ({
                employee: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                salaryAmount: Prisma.Decimal;
                effectiveFrom: Date;
                lockedFromPayrollId: string | null;
                employeeId: string;
            })[];
            auditLogs: ({
                user: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                } | null;
            } & {
                id: string;
                createdAt: Date;
                action: import(".prisma/client").$Enums.AuditAction;
                module: string;
                oldData: Prisma.JsonValue | null;
                newData: Prisma.JsonValue | null;
                ipAddress: string | null;
                userId: string | null;
            })[];
            ledger: ({
                employee: {
                    id: string;
                    employeeCode: string;
                    email: string | null;
                    phone: string;
                    name: string;
                    password: string;
                    address: string | null;
                    designation: string | null;
                    department: string | null;
                    joiningDate: Date;
                    salaryType: import(".prisma/client").$Enums.SalaryType;
                    status: import(".prisma/client").$Enums.EmployeeStatus;
                    role: import(".prisma/client").$Enums.Role;
                    profileImage: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                };
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
            })[];
            employees: {
                id: string;
                employeeCode: string;
                email: string | null;
                phone: string;
                name: string;
                password: string;
                address: string | null;
                designation: string | null;
                department: string | null;
                joiningDate: Date;
                salaryType: import(".prisma/client").$Enums.SalaryType;
                status: import(".prisma/client").$Enums.EmployeeStatus;
                role: import(".prisma/client").$Enums.Role;
                profileImage: string | null;
                createdAt: Date;
                updatedAt: Date;
            }[];
        };
        total: number;
    }>;
    static analytics(employeeWhere: Prisma.EmployeeWhereInput, range: DateRange): Promise<[{
        status: import(".prisma/client").$Enums.PayrollStatus;
        periodStart: Date;
        advanceDeduction: Prisma.Decimal;
        totalDeduction: Prisma.Decimal;
        finalSalary: Prisma.Decimal;
    }[], {
        status: import(".prisma/client").$Enums.AttendanceStatus;
        date: Date;
    }[], {
        date: Date;
        amount: Prisma.Decimal;
        remainingAmount: Prisma.Decimal;
        settledAmount: Prisma.Decimal;
    }[]]>;
}
export declare const dashboardEnums: {
    AttendanceStatus: {
        PRESENT: "PRESENT";
        ABSENT: "ABSENT";
        HALF_DAY: "HALF_DAY";
    };
    PayrollStatus: {
        GENERATED: "GENERATED";
        PAID: "PAID";
        SUPERSEDED: "SUPERSEDED";
        CANCELLED: "CANCELLED";
    };
    RequestStatus: {
        PENDING: "PENDING";
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
    };
};
export {};
//# sourceMappingURL=dashboard.repository.d.ts.map