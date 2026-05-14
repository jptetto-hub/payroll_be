import { AttendanceRequestType, AttendanceStatus, Prisma } from "@prisma/client";
export declare class AttendanceRequestRepository {
    static findEmployee(employeeId: string): Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        name: string;
        joiningDate: Date;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findAttendance(employeeId: string, date: Date): Prisma.Prisma__AttendanceClient<{
        id: string;
        status: import(".prisma/client").$Enums.AttendanceStatus;
        createdAt: Date;
        updatedAt: Date;
        date: Date;
        employeeId: string;
        lockedByPayrollId: string | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findPendingRequest(employeeId: string, date: Date): Prisma.Prisma__AttendanceRequestClient<{
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
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static create(data: {
        employeeId: string;
        attendanceDate: Date;
        oldStatus?: AttendanceStatus | null;
        requestedStatus: AttendanceStatus;
        requestType: AttendanceRequestType;
        reason: string;
        requestedById: string;
    }): Prisma.Prisma__AttendanceRequestClient<{
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
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static myRequests(employeeId: string): Prisma.PrismaPromise<{
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
    }[]>;
    static pendingRequests(): Prisma.PrismaPromise<({
        employee: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            designation: string | null;
            department: string | null;
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
    })[]>;
    static findById(id: string): Prisma.Prisma__AttendanceRequestClient<({
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
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static approveRequest(params: {
        requestId: string;
        approvedById: string;
        employeeId: string;
        attendanceDate: Date;
        requestedStatus: AttendanceStatus;
    }): Promise<{
        attendance: {
            id: string;
            status: import(".prisma/client").$Enums.AttendanceStatus;
            createdAt: Date;
            updatedAt: Date;
            date: Date;
            employeeId: string;
            lockedByPayrollId: string | null;
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
            requestedById: string;
            approvedById: string | null;
            approvedAt: Date | null;
            rejectionReason: string | null;
        };
    }>;
    static rejectRequest(params: {
        requestId: string;
        approvedById: string;
        rejectionReason: string;
    }): Prisma.Prisma__AttendanceRequestClient<{
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
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static createMany(records: {
        employeeId: string;
        attendanceDate: Date;
        oldStatus?: AttendanceStatus | null;
        requestedStatus: AttendanceStatus;
        requestType: AttendanceRequestType;
        reason: string;
        requestedById: string;
    }[]): Promise<{
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
    }[]>;
    static deleteOwnPendingRequest(requestId: string): Prisma.Prisma__AttendanceRequestClient<{
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
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findPendingRequestsByDates(employeeId: string, dates: Date[]): Prisma.PrismaPromise<{
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
    }[]>;
    static myRequestsAll(employeeId: string): Prisma.PrismaPromise<{
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
    }[]>;
    static pendingRequestsAll(employeeWhere?: Prisma.EmployeeWhereInput): Prisma.PrismaPromise<{
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
    }[]>;
    static pendingRequestsByEmployee(employeeId: string): Prisma.PrismaPromise<{
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
    }[]>;
    static myRequestsWithFilter(employeeId: string, from?: Date, to?: Date, pagination?: {
        skip: number;
        take: number;
    }): Prisma.PrismaPromise<{
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
    }[]>;
    static countMyRequestsWithFilter(employeeId: string, from?: Date, to?: Date): Prisma.PrismaPromise<number>;
    static pendingRequestsWithFilter(params: {
        employeeWhere?: Prisma.EmployeeWhereInput;
        from?: Date;
        to?: Date;
    }, pagination?: {
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
    })[]>;
    static countPendingRequestsWithFilter(params: {
        employeeWhere?: Prisma.EmployeeWhereInput;
        from?: Date;
        to?: Date;
    }): Prisma.PrismaPromise<number>;
    static findManyByIds(requestIds: string[]): Prisma.PrismaPromise<({
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
    })[]>;
    static approveMany(params: {
        requestIds: string[];
        approvedById: string;
    }): Promise<{
        attendanceResults: {
            id: string;
            status: import(".prisma/client").$Enums.AttendanceStatus;
            createdAt: Date;
            updatedAt: Date;
            date: Date;
            employeeId: string;
            lockedByPayrollId: string | null;
        }[];
        updatedRequests: Prisma.BatchPayload;
    }>;
    static rejectMany(params: {
        requestIds: string[];
        approvedById: string;
        rejectionReason: string;
    }): Prisma.PrismaPromise<Prisma.BatchPayload>;
}
//# sourceMappingURL=attendance-request.repository.d.ts.map