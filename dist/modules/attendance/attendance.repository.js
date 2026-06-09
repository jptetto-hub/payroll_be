"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
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
    static findEmployeeForRead(employeeId) {
        return prisma_1.readPrisma.employee.findUnique({
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
    static findEmployeesByIds(employeeIds) {
        return prisma_1.prisma.employee.findMany({
            where: {
                id: {
                    in: employeeIds,
                },
            },
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
        return prisma_1.readPrisma.attendance.findUnique({
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
    static findByEmployeeAndDates(records) {
        return prisma_1.prisma.attendance.findMany({
            where: {
                OR: records.map((record) => ({
                    employeeId: record.employeeId,
                    date: record.date,
                })),
            },
        });
    }
    static findManyByIdsForWrite(attendanceIds) {
        return prisma_1.prisma.attendance.findMany({
            where: {
                id: {
                    in: attendanceIds,
                },
            },
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
    static findActivePayrollLocks(params) {
        const maxLockDate = new Date(params.maxDate);
        maxLockDate.setUTCDate(maxLockDate.getUTCDate() + 1);
        return prisma_1.prisma.payroll.findMany({
            where: {
                employeeId: {
                    in: params.employeeIds,
                },
                status: {
                    in: [client_1.PayrollStatus.GENERATED, client_1.PayrollStatus.PAID],
                },
                periodStart: {
                    lte: maxLockDate,
                },
                periodEnd: {
                    gte: params.minDate,
                },
            },
            select: {
                employeeId: true,
                salaryType: true,
                periodStart: true,
                periodEnd: true,
            },
        });
    }
    static create(data) {
        return prisma_1.prisma.attendance.create({
            data,
        });
    }
    static createMany(records) {
        return prisma_1.prisma.attendance.createManyAndReturn({
            data: records,
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
        return prisma_1.readPrisma.attendance.findMany({
            where,
            take: params.take,
            ...(params.cursor
                ? {
                    skip: 1,
                    cursor: { id: params.cursor },
                }
                : {}),
            select: {
                id: true,
                employeeId: true,
                date: true,
                status: true,
                checkInTime: true,
                checkOutTime: true,
                otHours: true,
                otStartTime: true,
                otEndTime: true,
                otManualOverride: true,
                otOverrideReason: true,
                lockedByPayrollId: true,
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
            orderBy: { createdAt: "desc" },
        });
    }
    static listWithCount(params) {
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
        return Promise.all([
            prisma_1.readPrisma.attendance.findMany({
                where,
                skip: params.skip,
                take: params.take,
                select: {
                    id: true,
                    employeeId: true,
                    date: true,
                    status: true,
                    checkInTime: true,
                    checkOutTime: true,
                    otHours: true,
                    otStartTime: true,
                    otEndTime: true,
                    otManualOverride: true,
                    otOverrideReason: true,
                    lockedByPayrollId: true,
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
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.readPrisma.attendance.count({ where }),
        ]);
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.readPrisma.attendance.findMany({
            where: { employeeId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { date: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return prisma_1.readPrisma.attendance.count({
            where: { employeeId },
        });
    }
    static listByRange(employeeId, from, to, pagination) {
        return prisma_1.readPrisma.attendance.findMany({
            where: {
                employeeId,
                date: {
                    gte: from,
                    lte: to,
                },
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { date: "asc" },
        });
    }
    static countByRange(employeeId, from, to) {
        return prisma_1.readPrisma.attendance.count({
            where: {
                employeeId,
                date: {
                    gte: from,
                    lte: to,
                },
            },
        });
    }
    static listLatestRequestsByRange(employeeId, from, to) {
        return prisma_1.readPrisma.attendanceRequest.findMany({
            where: {
                employeeId,
                attendanceDate: {
                    gte: from,
                    lte: to,
                },
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
        if (records.length === 0) {
            return [];
        }
        const rows = records.map((record) => client_1.Prisma.sql `(
        ${record.attendanceId}::text,
        ${record.status}::"AttendanceStatus",
        ${record.checkInTime ?? null}::timestamp,
        ${record.checkOutTime ?? null}::timestamp,
        ${record.otStartTime ?? null}::timestamp,
        ${record.otEndTime ?? null}::timestamp,
        ${record.otHours ?? 0}::numeric,
        ${record.otManualOverride ?? false}::boolean,
        ${record.otOverrideReason ?? null}::text,
        ${JSON.stringify(record.otBreakdown ?? null)}::jsonb
      )`);
        return prisma_1.prisma.$queryRaw `
      UPDATE "Attendance" AS attendance
      SET
        status = incoming.status,
        "checkInTime" = incoming."checkInTime",
        "checkOutTime" = incoming."checkOutTime",
        "otStartTime" = incoming."otStartTime",
        "otEndTime" = incoming."otEndTime",
        "otHours" = incoming."otHours",
        "otManualOverride" = incoming."otManualOverride",
        "otOverrideReason" = incoming."otOverrideReason",
        "otBreakdown" = incoming."otBreakdown",
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${client_1.Prisma.join(rows)}
      ) AS incoming (
        id,
        status,
        "checkInTime",
        "checkOutTime",
        "otStartTime",
        "otEndTime",
        "otHours",
        "otManualOverride",
        "otOverrideReason",
        "otBreakdown"
      )
      WHERE attendance.id = incoming.id
      RETURNING attendance.*
    `;
    }
    static deleteMany(attendanceIds) {
        return prisma_1.prisma.attendance.deleteMany({
            where: {
                id: {
                    in: attendanceIds,
                },
            },
        });
    }
}
exports.AttendanceRepository = AttendanceRepository;
//# sourceMappingURL=attendance.repository.js.map