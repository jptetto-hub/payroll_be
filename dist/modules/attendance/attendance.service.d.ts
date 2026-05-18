import { AttendanceStatus, Role } from "@prisma/client";
type AttendanceOtInput = {
    checkInTime?: string | Date | null;
    checkOutTime?: string | Date | null;
    otStartTime?: string | Date | null;
    otEndTime?: string | Date | null;
    otHours?: number | null;
    otManualOverride?: boolean;
    otOverrideReason?: string | null;
};
export declare class AttendanceService {
    static list(query: any, currentUserRole: Role): Promise<{
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
            otHours: import("@prisma/client-runtime-utils").Decimal;
            otManualOverride: boolean;
            otOverrideReason: string | null;
            otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static createAttendance(data: {
        employeeId: string;
        date: string;
        status: AttendanceStatus;
    } & AttendanceOtInput, currentUserRole: Role): Promise<{
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
        otHours: import("@prisma/client-runtime-utils").Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    static bulkAttendance(records: ({
        employeeId: string;
        date: string;
        status: AttendanceStatus;
    } & AttendanceOtInput)[], currentUserRole: Role): Promise<{
        createdCount: number;
        skippedCount: number;
        records: {
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
            otHours: import("@prisma/client-runtime-utils").Decimal;
            otManualOverride: boolean;
            otOverrideReason: string | null;
            otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
        conflictMessage: string | null;
        conflicts: string[];
    }>;
    static listByEmployee(employeeId: string, currentUserRole: Role, currentUserId: string, query: any): Promise<{
        data: {
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
            otHours: import("@prisma/client-runtime-utils").Decimal;
            otManualOverride: boolean;
            otOverrideReason: string | null;
            otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static listByRange(employeeId: string, from: string, to: string, authUser: {
        id: string;
        role: Role;
    }, query: any): Promise<{
        data: {
            adminApprovalStatus: any;
            latestAttendanceRequest: any;
            employee: {
                id: string;
                employeeCode: string;
                phone: string;
                name: string;
                designation: string | null;
                department: string | null;
                salaryType: import(".prisma/client").$Enums.SalaryType;
            };
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
            otHours: import("@prisma/client-runtime-utils").Decimal;
            otManualOverride: boolean;
            otOverrideReason: string | null;
            otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static updateAttendance(id: string, data: {
        status: AttendanceStatus;
    } & AttendanceOtInput, currentUserRole: Role): Promise<{
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
        otHours: import("@prisma/client-runtime-utils").Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    static deleteAttendance(id: string, currentUserRole: Role): Promise<{
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
        otHours: import("@prisma/client-runtime-utils").Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    static bulkUpdateAttendance(records: ({
        attendanceId: string;
        status: AttendanceStatus;
        reason: string;
    } & AttendanceOtInput)[], currentUserRole: Role): Promise<{
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
        otHours: import("@prisma/client-runtime-utils").Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    static bulkDeleteAttendance(attendanceIds: string[], currentUserRole: Role, reason: string): Promise<{
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
        otHours: import("@prisma/client-runtime-utils").Decimal;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
}
export {};
//# sourceMappingURL=attendance.service.d.ts.map