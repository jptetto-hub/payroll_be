"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRequestRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const overtime_service_1 = require("../../services/overtime.service");
const stripUndefined = (data) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
class AttendanceRequestRepository {
    static findEmployee(employeeId) {
        return prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                role: true,
                status: true,
                joiningDate: true,
            },
        });
    }
    static findAttendance(employeeId, date) {
        return prisma_1.prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date,
                },
            },
        });
    }
    static findAttendancesByDates(employeeId, dates) {
        return prisma_1.prisma.attendance.findMany({
            where: {
                employeeId,
                date: {
                    in: dates,
                },
            },
        });
    }
    static findPendingRequest(employeeId, date) {
        return prisma_1.prisma.attendanceRequest.findFirst({
            where: {
                employeeId,
                attendanceDate: date,
                status: client_1.RequestStatus.PENDING,
            },
        });
    }
    static create(data) {
        return prisma_1.prisma.attendanceRequest.create({
            data,
        });
    }
    static myRequests(employeeId) {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                employeeId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
    static pendingRequests() {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                status: client_1.RequestStatus.PENDING,
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                    },
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });
    }
    static findById(id) {
        return prisma_1.prisma.attendanceRequest.findUnique({
            where: { id },
            include: {
                employee: true,
            },
        });
    }
    static approveRequest(params) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const ot = await overtime_service_1.OvertimeService.calculateForAttendance(stripUndefined({
                attendanceDate: params.attendanceDate,
                checkInTime: params.requestedCheckInTime,
                checkOutTime: params.requestedCheckOutTime,
                otStartTime: params.requestedOtStartTime,
                otEndTime: params.requestedOtEndTime,
                otHours: params.requestedOtHours,
                otManualOverride: params.requestedOtManualOverride,
                otOverrideReason: params.requestedOtOverrideReason,
            }));
            const attendance = await tx.attendance.upsert({
                where: {
                    employeeId_date: {
                        employeeId: params.employeeId,
                        date: params.attendanceDate,
                    },
                },
                update: stripUndefined({
                    status: params.requestedStatus,
                    checkInTime: params.requestedCheckInTime,
                    checkOutTime: params.requestedCheckOutTime,
                    otStartTime: ot.otStartTime,
                    otEndTime: ot.otEndTime,
                    otHours: ot.otHours,
                    otManualOverride: ot.otManualOverride,
                    otOverrideReason: ot.otOverrideReason,
                    otBreakdown: ot.otBreakdown,
                }),
                create: stripUndefined({
                    employeeId: params.employeeId,
                    date: params.attendanceDate,
                    status: params.requestedStatus,
                    checkInTime: params.requestedCheckInTime,
                    checkOutTime: params.requestedCheckOutTime,
                    otStartTime: ot.otStartTime,
                    otEndTime: ot.otEndTime,
                    otHours: ot.otHours,
                    otManualOverride: ot.otManualOverride,
                    otOverrideReason: ot.otOverrideReason,
                    otBreakdown: ot.otBreakdown,
                }),
            });
            const request = await tx.attendanceRequest.update({
                where: { id: params.requestId },
                data: {
                    status: "APPROVED",
                    approvedById: params.approvedById,
                    approvedAt: new Date(),
                },
            });
            return {
                attendance,
                request,
            };
        });
    }
    static rejectRequest(params) {
        return prisma_1.prisma.attendanceRequest.update({
            where: { id: params.requestId },
            data: {
                status: "REJECTED",
                approvedById: params.approvedById,
                approvedAt: new Date(),
                rejectionReason: params.rejectionReason,
            },
        });
    }
    static createMany(records) {
        return prisma_1.prisma.attendanceRequest.createManyAndReturn({
            data: records.map((record) => stripUndefined(record)),
        });
    }
    static deleteOwnPendingRequest(requestId) {
        return prisma_1.prisma.attendanceRequest.delete({
            where: { id: requestId },
        });
    }
    static findPendingRequestsByDates(employeeId, dates) {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                employeeId,
                attendanceDate: {
                    in: dates,
                },
                status: "PENDING",
            },
        });
    }
    static myRequestStatusCounts(employeeId) {
        return prisma_1.readPrisma.attendanceRequest.groupBy({
            by: ["status"],
            where: { employeeId },
            _count: true,
        });
    }
    static myRequestRangeStatusCounts(employeeId, from, to) {
        return prisma_1.readPrisma.attendanceRequest.groupBy({
            by: ["status"],
            where: {
                employeeId,
                ...(from &&
                    to && {
                    attendanceDate: {
                        gte: from,
                        lte: to,
                    },
                }),
            },
            _count: true,
        });
    }
    static pendingRequestsAll(params) {
        return prisma_1.readPrisma.attendanceRequest.count({
            where: {
                status: "PENDING",
                ...(params.employeeId
                    ? { employeeId: params.employeeId }
                    : params.employeeWhere && { employee: params.employeeWhere }),
            },
        });
    }
    static pendingRequestsByEmployee(employeeId) {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                employeeId,
                status: "PENDING",
            },
        });
    }
    static myRequestsWithFilter(employeeId, from, to, pagination) {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                employeeId,
                ...(from &&
                    to && {
                    attendanceDate: {
                        gte: from,
                        lte: to,
                    },
                }),
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: {
                attendanceDate: "asc",
            },
        });
    }
    static pendingRequestsWithFilter(params, pagination) {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                status: "PENDING",
                ...(params.employeeId
                    ? { employeeId: params.employeeId }
                    : params.employeeWhere && { employee: params.employeeWhere }),
                ...(params.from &&
                    params.to && {
                    attendanceDate: {
                        gte: params.from,
                        lte: params.to,
                    },
                }),
            },
            select: {
                id: true,
                employeeId: true,
                attendanceDate: true,
                oldStatus: true,
                requestedStatus: true,
                requestType: true,
                reason: true,
                status: true,
                requestedById: true,
                approvedById: true,
                approvedAt: true,
                rejectionReason: true,
                requestedCheckInTime: true,
                requestedCheckOutTime: true,
                requestedOtStartTime: true,
                requestedOtEndTime: true,
                requestedOtHours: true,
                requestedOtManualOverride: true,
                requestedOtOverrideReason: true,
                createdAt: true,
                updatedAt: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                        salaryType: true,
                    },
                },
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: {
                attendanceDate: "asc",
            },
        });
    }
    static countPendingRequestsWithFilter(params) {
        return prisma_1.readPrisma.attendanceRequest.count({
            where: {
                status: "PENDING",
                ...(params.employeeId
                    ? { employeeId: params.employeeId }
                    : params.employeeWhere && { employee: params.employeeWhere }),
                ...(params.from &&
                    params.to && {
                    attendanceDate: {
                        gte: params.from,
                        lte: params.to,
                    },
                }),
            },
        });
    }
    static findManyByIds(requestIds) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                id: {
                    in: requestIds,
                },
            },
            include: {
                employee: true,
            },
        });
    }
    static async approveMany(params) {
        const dates = params.requests.map((request) => request.attendanceDate);
        const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
        const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
        const settings = await overtime_service_1.OvertimeService.getSettingsForDateRange(minDate, maxDate);
        const preparedAttendances = await Promise.all(params.requests.map(async (request) => {
            const setting = overtime_service_1.OvertimeService.resolveSettingFromList(settings, request.attendanceDate);
            const ot = await overtime_service_1.OvertimeService.calculateForAttendance(stripUndefined({
                attendanceDate: request.attendanceDate,
                checkInTime: request.requestedCheckInTime,
                checkOutTime: request.requestedCheckOutTime,
                otStartTime: request.requestedOtStartTime,
                otEndTime: request.requestedOtEndTime,
                otHours: request.requestedOtHours === null
                    ? null
                    : Number(request.requestedOtHours ?? 0),
                otManualOverride: request.requestedOtManualOverride,
                otOverrideReason: request.requestedOtOverrideReason,
                setting,
            }));
            return {
                request,
                ot,
            };
        }));
        const approvedAt = new Date();
        const transactions = preparedAttendances.map(({ request, ot }) => prisma_1.prisma.attendance.upsert({
            where: {
                employeeId_date: {
                    employeeId: request.employeeId,
                    date: request.attendanceDate,
                },
            },
            update: stripUndefined({
                status: request.requestedStatus,
                checkInTime: request.requestedCheckInTime,
                checkOutTime: request.requestedCheckOutTime,
                otStartTime: ot.otStartTime,
                otEndTime: ot.otEndTime,
                otHours: ot.otHours,
                otManualOverride: ot.otManualOverride,
                otOverrideReason: ot.otOverrideReason,
                otBreakdown: ot.otBreakdown,
            }),
            create: stripUndefined({
                employeeId: request.employeeId,
                date: request.attendanceDate,
                status: request.requestedStatus,
                checkInTime: request.requestedCheckInTime,
                checkOutTime: request.requestedCheckOutTime,
                otStartTime: ot.otStartTime,
                otEndTime: ot.otEndTime,
                otHours: ot.otHours,
                otManualOverride: ot.otManualOverride,
                otOverrideReason: ot.otOverrideReason,
                otBreakdown: ot.otBreakdown,
            }),
        }));
        const results = await prisma_1.prisma.$transaction([
            ...transactions,
            prisma_1.prisma.attendanceRequest.updateMany({
                where: {
                    id: {
                        in: params.requests.map((request) => request.id),
                    },
                },
                data: {
                    status: "APPROVED",
                    approvedById: params.approvedById,
                    approvedAt,
                },
            }),
        ]);
        return {
            attendanceResults: results.slice(0, -1),
            updatedRequests: results.at(-1),
        };
    }
    static rejectMany(params) {
        return prisma_1.prisma.attendanceRequest.updateMany({
            where: {
                id: {
                    in: params.requestIds,
                },
            },
            data: {
                status: "REJECTED",
                approvedById: params.approvedById,
                approvedAt: new Date(),
                rejectionReason: params.rejectionReason,
            },
        });
    }
}
exports.AttendanceRequestRepository = AttendanceRequestRepository;
//# sourceMappingURL=attendance-request.repository.js.map