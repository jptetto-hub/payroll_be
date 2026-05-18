"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRepository = void 0;
const prisma_1 = require("../../config/prisma");
const stripUndefined = (data) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
class AttendanceRepository {
    static findEmployee(employeeId) {
        return prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                role: true,
                status: true,
                salaryType: true,
                joiningDate: true,
            },
        });
    }
    static findById(id) {
        return prisma_1.prisma.attendance.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        role: true,
                        status: true,
                        joiningDate: true,
                    },
                },
            },
        });
    }
    static findByEmployeeAndDate(employeeId, date) {
        return prisma_1.prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date,
                },
            },
        });
    }
    static create(data) {
        return prisma_1.prisma.attendance.create({
            data,
        });
    }
    static upsert(data) {
        return prisma_1.prisma.attendance.upsert({
            where: {
                employeeId_date: {
                    employeeId: data.employeeId,
                    date: data.date,
                },
            },
            update: stripUndefined({
                status: data.status,
                checkInTime: data.checkInTime,
                checkOutTime: data.checkOutTime,
                otStartTime: data.otStartTime,
                otEndTime: data.otEndTime,
                otHours: data.otHours,
                otManualOverride: data.otManualOverride,
                otOverrideReason: data.otOverrideReason,
                otBreakdown: data.otBreakdown,
            }),
            create: data,
        });
    }
    static list(params) {
        const where = {
            ...(params.employeeId && { employeeId: params.employeeId }),
            ...(params.status && { status: params.status }),
            ...(params.from &&
                params.to && {
                date: {
                    gte: params.from,
                    lte: params.to,
                },
            }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.attendance.findMany({
                where,
                skip: params.skip,
                take: params.take,
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
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.attendance.count({ where }),
        ]);
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.prisma.attendance.findMany({
            where: { employeeId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { date: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return prisma_1.prisma.attendance.count({
            where: { employeeId },
        });
    }
    static listByRange(employeeWhere, from, to, pagination) {
        return prisma_1.prisma.attendance.findMany({
            where: {
                employee: employeeWhere,
                date: {
                    gte: from,
                    lte: to,
                },
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
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
            orderBy: { date: "asc" },
        });
    }
    static countByRange(employeeWhere, from, to) {
        return prisma_1.prisma.attendance.count({
            where: {
                employee: employeeWhere,
                date: {
                    gte: from,
                    lte: to,
                },
            },
        });
    }
    static listLatestRequestsByRange(employeeWhere, from, to) {
        return prisma_1.prisma.attendanceRequest.findMany({
            where: {
                employee: employeeWhere,
                attendanceDate: {
                    gte: from,
                    lte: to,
                },
            },
            orderBy: [
                {
                    attendanceDate: "asc",
                },
                {
                    updatedAt: "desc",
                },
            ],
        });
    }
    static update(id, data) {
        return prisma_1.prisma.attendance.update({
            where: { id },
            data,
        });
    }
    static delete(id) {
        return prisma_1.prisma.attendance.delete({
            where: { id },
        });
    }
    static updateMany(records) {
        return prisma_1.prisma.$transaction(records.map((record) => prisma_1.prisma.attendance.update({
            where: { id: record.attendanceId },
            data: stripUndefined({
                status: record.status,
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                otStartTime: record.otStartTime,
                otEndTime: record.otEndTime,
                otHours: record.otHours,
                otManualOverride: record.otManualOverride,
                otOverrideReason: record.otOverrideReason,
                otBreakdown: record.otBreakdown,
            }),
        })));
    }
    static deleteMany(attendanceIds) {
        return prisma_1.prisma.$transaction(attendanceIds.map((id) => prisma_1.prisma.attendance.delete({
            where: { id },
        })));
    }
}
exports.AttendanceRepository = AttendanceRepository;
//# sourceMappingURL=attendance.repository.js.map