"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const client_1 = require("@prisma/client");
const attendance_repository_1 = require("./attendance.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const normalizeDate = (date) => {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const ensureDateOnOrAfterJoining = (params) => {
    if (formatDate(params.date) < formatDate(params.joiningDate)) {
        throw new Error(`${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`);
    }
};
const ensureNotFutureDate = (date) => {
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (date > todayUtc) {
        throw new Error("Future attendance is not allowed");
    }
};
const ensureValidRange = (fromDate, toDate) => {
    if (fromDate > toDate) {
        throw new Error("From date cannot be greater than To date");
    }
    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
        throw new Error("Date range cannot exceed 366 days");
    }
};
const ensureAllowedEmployeeAccess = (targetEmployeeRole, currentUserRole) => {
    if (currentUserRole === client_1.Role.ADMIN && targetEmployeeRole !== client_1.Role.USER) {
        throw new Error("ADMIN can manage attendance only for USER employees");
    }
};
const getOrdinalDay = (day) => {
    if (day > 3 && day < 21)
        return `${day}th`;
    const suffix = ["th", "st", "nd", "rd"][day % 10] ?? "th";
    return `${day}${suffix}`;
};
const formatMonth = (date) => date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
const formatDateRange = (start, end) => {
    const startDay = getOrdinalDay(start.getUTCDate());
    const endDay = getOrdinalDay(end.getUTCDate());
    const startMonth = formatMonth(start);
    const endMonth = formatMonth(end);
    if (start.getTime() === end.getTime()) {
        return `${startDay} of ${startMonth}`;
    }
    if (start.getUTCFullYear() === end.getUTCFullYear() &&
        start.getUTCMonth() === end.getUTCMonth()) {
        return `${startDay} to ${endDay} of ${startMonth}`;
    }
    return `${startDay} of ${startMonth} to ${endDay} of ${endMonth}`;
};
const formatDateRanges = (dates) => {
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const ranges = [];
    let rangeStart = sortedDates[0];
    let previousDate = sortedDates[0];
    if (!rangeStart || !previousDate) {
        return "";
    }
    for (const date of sortedDates.slice(1)) {
        const diffDays = (date.getTime() - previousDate.getTime()) / MS_PER_DAY;
        if (diffDays === 1) {
            previousDate = date;
            continue;
        }
        ranges.push(formatDateRange(rangeStart, previousDate));
        rangeStart = date;
        previousDate = date;
    }
    ranges.push(formatDateRange(rangeStart, previousDate));
    if (ranges.length <= 1) {
        return ranges.join("");
    }
    return `${ranges.slice(0, -1).join(", ")} and ${ranges.at(-1)}`;
};
class AttendanceService {
    static async list(query, currentUserRole) {
        if (currentUserRole === client_1.Role.USER) {
            throw new Error("USER cannot list all attendance");
        }
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const fromDate = query.from ? normalizeDate(query.from) : undefined;
        const toDate = query.to ? normalizeDate(query.to) : undefined;
        if ((fromDate && !toDate) || (!fromDate && toDate)) {
            throw new Error("Both from and to dates are required");
        }
        if (fromDate && toDate) {
            ensureValidRange(fromDate, toDate);
        }
        const [attendance, total] = await attendance_repository_1.AttendanceRepository.list({
            skip,
            take,
            ...(query.employeeId && { employeeId: query.employeeId }),
            ...(query.status && { status: query.status }),
            ...(fromDate && { from: fromDate }),
            ...(toDate && { to: toDate }),
        });
        return {
            data: attendance,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async createAttendance(data, currentUserRole) {
        const employee = await attendance_repository_1.AttendanceRepository.findEmployee(data.employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        if (employee.status !== "ACTIVE") {
            throw new Error("Cannot add attendance for inactive employee");
        }
        ensureAllowedEmployeeAccess(employee.role, currentUserRole);
        const attendanceDate = normalizeDate(data.date);
        ensureNotFutureDate(attendanceDate);
        ensureDateOnOrAfterJoining({
            date: attendanceDate,
            joiningDate: employee.joiningDate,
            action: "Attendance date",
        });
        await (0, payroll_lock_util_1.assertAttendanceNotLocked)(data.employeeId, attendanceDate);
        const existing = await attendance_repository_1.AttendanceRepository.findByEmployeeAndDate(data.employeeId, attendanceDate);
        if (existing) {
            throw new Error("Attendance already exists for this employee on this date");
        }
        return attendance_repository_1.AttendanceRepository.create({
            employeeId: data.employeeId,
            date: attendanceDate,
            status: data.status,
        });
    }
    static async bulkAttendance(records, currentUserRole) {
        const seen = new Set();
        const normalizedRecords = [];
        const existingDatesByEmployee = new Map();
        for (const record of records) {
            const key = `${record.employeeId}_${record.date}`;
            if (seen.has(key)) {
                throw new Error(`Duplicate attendance record in request body for employee ${record.employeeId} on ${record.date}`);
            }
            seen.add(key);
        }
        for (const record of records) {
            const employee = await attendance_repository_1.AttendanceRepository.findEmployee(record.employeeId);
            if (!employee) {
                throw new Error(`Employee not found: ${record.employeeId}`);
            }
            if (employee.status !== "ACTIVE") {
                throw new Error(`Cannot mark attendance for inactive employee: ${employee.employeeCode}`);
            }
            ensureAllowedEmployeeAccess(employee.role, currentUserRole);
            const attendanceDate = normalizeDate(record.date);
            ensureNotFutureDate(attendanceDate);
            ensureDateOnOrAfterJoining({
                date: attendanceDate,
                joiningDate: employee.joiningDate,
                action: `Attendance date for ${employee.employeeCode}`,
            });
            await (0, payroll_lock_util_1.assertAttendanceNotLocked)(record.employeeId, attendanceDate);
            const existing = await attendance_repository_1.AttendanceRepository.findByEmployeeAndDate(record.employeeId, attendanceDate);
            if (existing) {
                const existingDates = existingDatesByEmployee.get(record.employeeId);
                if (existingDates) {
                    existingDates.dates.push(attendanceDate);
                }
                else {
                    existingDatesByEmployee.set(record.employeeId, {
                        employeeCode: employee.employeeCode,
                        dates: [attendanceDate],
                    });
                }
            }
            normalizedRecords.push({
                employeeId: record.employeeId,
                attendanceDate,
                status: record.status,
                hasExistingAttendance: Boolean(existing),
            });
        }
        const results = [];
        for (const record of normalizedRecords.filter((item) => !item.hasExistingAttendance)) {
            const saved = await attendance_repository_1.AttendanceRepository.create({
                employeeId: record.employeeId,
                date: record.attendanceDate,
                status: record.status,
            });
            results.push(saved);
        }
        const conflicts = [...existingDatesByEmployee.values()].map((item) => `${item.employeeCode}: ${formatDateRanges(item.dates)}`);
        const conflictMessage = conflicts.length > 0
            ? `Attendance already exists for ${conflicts.join("; ")}`
            : null;
        return {
            createdCount: results.length,
            skippedCount: normalizedRecords.length - results.length,
            records: results,
            conflictMessage,
            conflicts,
        };
    }
    static async listByEmployee(employeeId, currentUserRole, currentUserId, query) {
        if (currentUserRole === client_1.Role.USER && employeeId !== currentUserId) {
            throw new Error("USER can view only own attendance");
        }
        const employee = await attendance_repository_1.AttendanceRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureAllowedEmployeeAccess(employee.role, currentUserRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [attendance, total] = await Promise.all([
            attendance_repository_1.AttendanceRepository.listByEmployee(employeeId, { skip, take }),
            attendance_repository_1.AttendanceRepository.countByEmployee(employeeId),
        ]);
        return {
            data: attendance,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async listByRange(employeeId, from, to, authUser, query) {
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({ authUser, employeeId });
        const fromDate = normalizeDate(from);
        const toDate = normalizeDate(to);
        ensureValidRange(fromDate, toDate);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [attendanceRecords, total] = await Promise.all([
            attendance_repository_1.AttendanceRepository.listByRange(employeeWhere, fromDate, toDate, {
                skip,
                take,
            }),
            attendance_repository_1.AttendanceRepository.countByRange(employeeWhere, fromDate, toDate),
        ]);
        const requests = await attendance_repository_1.AttendanceRepository.listLatestRequestsByRange(employeeWhere, fromDate, toDate);
        const latestRequestMap = new Map();
        for (const request of requests) {
            const key = `${request.employeeId}_${request.attendanceDate.toISOString().slice(0, 10)}`;
            if (!latestRequestMap.has(key)) {
                latestRequestMap.set(key, request);
            }
        }
        const data = attendanceRecords.map((attendance) => {
            const key = `${attendance.employeeId}_${attendance.date.toISOString().slice(0, 10)}`;
            const latestRequest = latestRequestMap.get(key);
            return {
                ...attendance,
                adminApprovalStatus: latestRequest
                    ? latestRequest.status
                    : "ADMIN_ATTENDANCE",
                latestAttendanceRequest: latestRequest ?? null,
            };
        });
        return {
            data,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async updateAttendance(id, status, currentUserRole) {
        const attendance = await attendance_repository_1.AttendanceRepository.findById(id);
        if (!attendance) {
            throw new Error("Attendance record not found");
        }
        ensureAllowedEmployeeAccess(attendance.employee.role, currentUserRole);
        ensureNotFutureDate(attendance.date);
        ensureDateOnOrAfterJoining({
            date: attendance.date,
            joiningDate: attendance.employee.joiningDate,
            action: "Attendance date",
        });
        await (0, payroll_lock_util_1.assertAttendanceNotLocked)(attendance.employeeId, attendance.date);
        return attendance_repository_1.AttendanceRepository.update(id, status);
    }
    static async deleteAttendance(id, currentUserRole) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can delete attendance");
        }
        const attendance = await attendance_repository_1.AttendanceRepository.findById(id);
        if (!attendance) {
            throw new Error("Attendance record not found");
        }
        await (0, payroll_lock_util_1.assertAttendanceNotLocked)(attendance.employeeId, attendance.date);
        return attendance_repository_1.AttendanceRepository.delete(id);
    }
    static async bulkUpdateAttendance(records, currentUserRole) {
        const seen = new Set();
        for (const record of records) {
            if (seen.has(record.attendanceId)) {
                throw new Error(`Duplicate attendanceId in request: ${record.attendanceId}`);
            }
            seen.add(record.attendanceId);
            const attendance = await attendance_repository_1.AttendanceRepository.findById(record.attendanceId);
            if (!attendance) {
                throw new Error(`Attendance record not found: ${record.attendanceId}`);
            }
            ensureAllowedEmployeeAccess(attendance.employee.role, currentUserRole);
            ensureNotFutureDate(attendance.date);
            ensureDateOnOrAfterJoining({
                date: attendance.date,
                joiningDate: attendance.employee.joiningDate,
                action: "Attendance date",
            });
            await (0, payroll_lock_util_1.assertAttendanceNotLocked)(attendance.employeeId, attendance.date);
        }
        return attendance_repository_1.AttendanceRepository.updateMany(records.map((record) => ({
            attendanceId: record.attendanceId,
            status: record.status,
        })));
    }
    static async bulkDeleteAttendance(attendanceIds, currentUserRole, reason) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can bulk delete attendance");
        }
        if (!reason || reason.trim().length < 5) {
            throw new Error("Delete reason is required");
        }
        const seen = new Set();
        for (const attendanceId of attendanceIds) {
            if (seen.has(attendanceId)) {
                throw new Error(`Duplicate attendanceId in request: ${attendanceId}`);
            }
            seen.add(attendanceId);
            const attendance = await attendance_repository_1.AttendanceRepository.findById(attendanceId);
            if (!attendance) {
                throw new Error(`Attendance record not found: ${attendanceId}`);
            }
            await (0, payroll_lock_util_1.assertAttendanceNotLocked)(attendance.employeeId, attendance.date);
        }
        return attendance_repository_1.AttendanceRepository.deleteMany(attendanceIds);
    }
}
exports.AttendanceService = AttendanceService;
//# sourceMappingURL=attendance.service.js.map