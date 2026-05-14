import { AttendanceStatus, Role } from "@prisma/client";
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
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static createAttendance(data: {
        employeeId: string;
        date: string;
        status: AttendanceStatus;
    }, currentUserRole: Role): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    }>;
    static bulkAttendance(records: {
        employeeId: string;
        date: string;
        status: AttendanceStatus;
    }[], currentUserRole: Role): Promise<{
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
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static updateAttendance(id: string, status: AttendanceStatus, currentUserRole: Role): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    }>;
    static deleteAttendance(id: string, currentUserRole: Role): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    }>;
    static bulkUpdateAttendance(records: {
        attendanceId: string;
        status: AttendanceStatus;
        reason: string;
    }[], currentUserRole: Role): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    }[]>;
    static bulkDeleteAttendance(attendanceIds: string[], currentUserRole: Role, reason: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    }[]>;
}
//# sourceMappingURL=attendance.service.d.ts.map