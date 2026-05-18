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
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                employeeId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
    static pendingRequests() {
        return prisma_1.prisma.attendanceRequest.findMany({
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
        return prisma_1.prisma.$transaction(records.map((record) => prisma_1.prisma.attendanceRequest.create({
            data: stripUndefined(record),
        })));
    }
    static deleteOwnPendingRequest(requestId) {
        return prisma_1.prisma.attendanceRequest.delete({
            where: { id: requestId },
        });
    }
    static findPendingRequestsByDates(employeeId, dates) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                employeeId,
                attendanceDate: {
                    in: dates,
                },
                status: "PENDING",
            },
        });
    }
    static myRequestsAll(employeeId) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: { employeeId },
        });
    }
    static pendingRequestsAll(employeeWhere) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                status: "PENDING",
                ...(employeeWhere && { employee: employeeWhere }),
            },
        });
    }
    static pendingRequestsByEmployee(employeeId) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                employeeId,
                status: "PENDING",
            },
        });
    }
    static myRequestsWithFilter(employeeId, from, to, pagination) {
        return prisma_1.prisma.attendanceRequest.findMany({
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
    static countMyRequestsWithFilter(employeeId, from, to) {
        return prisma_1.prisma.attendanceRequest.count({
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
        });
    }
    static pendingRequestsWithFilter(params, pagination) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                status: "PENDING",
                ...(params.employeeWhere && { employee: params.employeeWhere }),
                ...(params.from &&
                    params.to && {
                    attendanceDate: {
                        gte: params.from,
                        lte: params.to,
                    },
                }),
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
        return prisma_1.prisma.attendanceRequest.count({
            where: {
                status: "PENDING",
                ...(params.employeeWhere && { employee: params.employeeWhere }),
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
    static approveMany(params) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const requests = await tx.attendanceRequest.findMany({
                where: {
                    id: {
                        in: params.requestIds,
                    },
                },
            });
            const attendanceResults = [];
            for (const request of requests) {
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
                }));
                const attendance = await tx.attendance.upsert({
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
                });
                attendanceResults.push(attendance);
            }
            const updatedRequests = await tx.attendanceRequest.updateMany({
                where: {
                    id: {
                        in: params.requestIds,
                    },
                },
                data: {
                    status: "APPROVED",
                    approvedById: params.approvedById,
                    approvedAt: new Date(),
                },
            });
            return {
                attendanceResults,
                updatedRequests,
            };
        });
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