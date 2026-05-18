import { AttendanceStatus, Prisma } from "@prisma/client";
export declare class AttendanceRepository {
    static findEmployee(employeeId: string): Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        name: string;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findById(id: string): Prisma.Prisma__AttendanceClient<({
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            joiningDate: Date;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findByEmployeeAndDate(employeeId: string, date: Date): Prisma.Prisma__AttendanceClient<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static create(data: {
        employeeId: string;
        date: Date;
        status: AttendanceStatus;
        checkInTime?: Date | null;
        checkOutTime?: Date | null;
        otStartTime?: Date | null;
        otEndTime?: Date | null;
        otHours?: number;
        otManualOverride?: boolean;
        otOverrideReason?: string | null;
        otBreakdown?: any;
    }): Prisma.Prisma__AttendanceClient<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static upsert(data: {
        employeeId: string;
        date: Date;
        status: AttendanceStatus;
        checkInTime?: Date | null;
        checkOutTime?: Date | null;
        otStartTime?: Date | null;
        otEndTime?: Date | null;
        otHours?: number;
        otManualOverride?: boolean;
        otOverrideReason?: string | null;
        otBreakdown?: any;
    }): Prisma.Prisma__AttendanceClient<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static list(params: {
        employeeId?: string;
        status?: AttendanceStatus;
        from?: Date;
        to?: Date;
        skip: number;
        take: number;
    }): Promise<[({
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
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    })[], number]>;
    static listByEmployee(employeeId: string, pagination?: {
        skip: number;
        take: number;
    }): Prisma.PrismaPromise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }[]>;
    static countByEmployee(employeeId: string): Prisma.PrismaPromise<number>;
    static listByRange(employeeWhere: Prisma.EmployeeWhereInput, from: Date, to: Date, pagination?: {
        skip: number;
        take: number;
    }): Prisma.PrismaPromise<({
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
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    })[]>;
    static countByRange(employeeWhere: Prisma.EmployeeWhereInput, from: Date, to: Date): Prisma.PrismaPromise<number>;
    static listLatestRequestsByRange(employeeWhere: Prisma.EmployeeWhereInput, from: Date, to: Date): Prisma.PrismaPromise<{
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
        requestedCheckInTime: Date | null;
        requestedCheckOutTime: Date | null;
        requestedOtStartTime: Date | null;
        requestedOtEndTime: Date | null;
        requestedOtHours: Prisma.Decimal | null;
        requestedOtManualOverride: boolean;
        requestedOtOverrideReason: string | null;
        requestedById: string;
        approvedById: string | null;
        approvedAt: Date | null;
        rejectionReason: string | null;
    }[]>;
    static update(id: string, data: {
        status: AttendanceStatus;
    } & Record<string, any>): Prisma.Prisma__AttendanceClient<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static delete(id: string): Prisma.Prisma__AttendanceClient<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static updateMany(records: {
        attendanceId: string;
        status: AttendanceStatus;
        checkInTime?: Date | null;
        checkOutTime?: Date | null;
        otStartTime?: Date | null;
        otEndTime?: Date | null;
        otHours?: number;
        otManualOverride?: boolean;
        otOverrideReason?: string | null;
        otBreakdown?: any;
    }[]): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }[]>;
    static deleteMany(attendanceIds: string[]): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otHours: Prisma.Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: Prisma.JsonValue | null;
    }[]>;
}
//# sourceMappingURL=attendance.repository.d.ts.map