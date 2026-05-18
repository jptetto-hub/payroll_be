import { AttendanceRequestType, AttendanceStatus, Prisma, Role } from "@prisma/client";
export declare class AttendanceRequestService {
    static createRequest(data: {
        requests: {
            attendanceDate: string;
            requestedStatus: AttendanceStatus;
            requestType: AttendanceRequestType;
            reason: string;
            requestedCheckInTime?: string | null;
            requestedCheckOutTime?: string | null;
            requestedOtStartTime?: string | null;
            requestedOtEndTime?: string | null;
            requestedOtHours?: number | null;
            requestedOtManualOverride?: boolean;
            requestedOtOverrideReason?: string | null;
        }[];
    }, currentUser: {
        id: string;
        role: Role;
    }): Promise<{
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
    static myRequests(employeeId: string, query: {
        from?: string;
        to?: string;
        page?: string | number;
        limit?: string | number;
    }): Promise<{
        data: {
            overallCount: {
                total: number;
                pending: number;
                approved: number;
                rejected: number;
            };
            rangeCount: {
                total: number;
                pending: number;
                approved: number;
                rejected: number;
            };
            pending: any[];
            approved: any[];
            rejected: any[];
        };
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static pendingRequests(query: {
        employeeId?: string;
        from?: string;
        to?: string;
        page?: string | number;
        limit?: string | number;
    }, authUser: {
        id: string;
        role: Role;
    }): Promise<{
        data: {
            overallPendingCount: number;
            employeePendingCount: number;
            employeeRangePendingCount: number;
            requestedStatusCounts: {
                present: number;
                absent: number;
                halfDay: number;
            };
            requests: ({
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
            })[];
        };
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static decisionRequests(data: {
        requestIds: string[];
        action: "APPROVE" | "REJECT";
        rejectionReason?: string;
    }, approvedById: string): Promise<Prisma.BatchPayload | {
        attendanceResults: {
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
        }[];
        updatedRequests: Prisma.BatchPayload;
    }>;
    static approveRequest(requestId: string, approvedById: string): Promise<{
        attendance: {
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
        };
        request: {
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
        };
    }>;
    static rejectRequest(requestId: string, approvedById: string, rejectionReason: string): Promise<{
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
    }>;
    static deleteOwnRequest(requestId: string, currentUser: {
        id: string;
        role: Role;
    }): Promise<{
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
    }>;
}
//# sourceMappingURL=attendance-request.service.d.ts.map