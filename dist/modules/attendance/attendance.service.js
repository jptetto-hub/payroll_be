"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const client_1 = require("@prisma/client");
const attendance_repository_1 = require("./attendance.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const cursor_pagination_util_1 = require("../../shared/utils/cursor-pagination.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const overtime_service_1 = require("../../services/overtime.service");
const app_error_1 = require("../../shared/utils/app-error");
const cache_1 = require("../../utils/cache");
const business_date_util_1 = require("../../shared/time/business-date.util");
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const invalidateAttendanceCaches = () => {
    void Promise.all([
        cache_1.CacheService.delByPattern("attendance-read:*"),
        cache_1.CacheService.delByPattern("attendance-requests-read:*"),
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
        cache_1.CacheService.delByPattern("attendance-summary:*"),
    ]);
};
const attendanceReadCacheKey = (section, ...parts) => cache_1.CacheService.buildKey("attendance-read", section, ...parts);
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
    if (date > (0, business_date_util_1.getBusinessDate)()) {
        throw new Error("Future attendance is not allowed");
    }
};
const isSunday = (date) => date.getUTCDay() === 0;
const hasOtInput = (input) => Number(input.otHours ?? 0) > 0 || Boolean(input.otStartTime && input.otEndTime);
const ensureSundayAttendanceIsOtOnly = (attendanceDate, input) => {
    if (!isSunday(attendanceDate)) {
        return;
    }
    if (!hasOtInput(input)) {
        throw new Error("Sunday attendance is skipped. Add OT hours only for Sunday.");
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
const parseOptionalDateTime = (value) => {
    if (!value)
        return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date-time value");
    }
    return parsed;
};
const buildAttendancePayload = async (attendanceDate, input, settings) => {
    const checkInTime = parseOptionalDateTime(input.checkInTime);
    const checkOutTime = parseOptionalDateTime(input.checkOutTime);
    const otStartTime = parseOptionalDateTime(input.otStartTime);
    const otEndTime = parseOptionalDateTime(input.otEndTime);
    const setting = settings
        ? overtime_service_1.OvertimeService.resolveSettingFromList(settings, attendanceDate)
        : undefined;
    const ot = await overtime_service_1.OvertimeService.calculateForAttendance({
        attendanceDate,
        checkInTime,
        checkOutTime,
        otStartTime,
        otEndTime,
        ...(input.otHours !== undefined && { otHours: input.otHours }),
        ...(input.otManualOverride !== undefined && {
            otManualOverride: input.otManualOverride,
        }),
        ...(input.otOverrideReason !== undefined && {
            otOverrideReason: input.otOverrideReason,
        }),
        ...(setting && { setting }),
    });
    return {
        checkInTime,
        checkOutTime,
        ...ot,
    };
};
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const attendanceKey = (employeeId, date) => `${employeeId}_${formatDate(date)}`;
const getDateBounds = (dates) => ({
    minDate: new Date(Math.min(...dates.map((date) => date.getTime()))),
    maxDate: new Date(Math.max(...dates.map((date) => date.getTime()))),
});
const assertNotLockedFromPreloadedPayrolls = (employeeId, date, payrolls) => {
    const locked = payrolls.some((payroll) => payroll.employeeId === employeeId &&
        (0, payroll_lock_util_1.isAttendanceDateLockedByPayroll)(payroll, date));
    if (locked) {
        throw new app_error_1.AppError("Attendance is locked because payroll is already generated for this period. Cancel or recalculate payroll before editing.", 400);
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
        const fromDate = query.from ? normalizeDate(query.from) : undefined;
        const toDate = query.to ? normalizeDate(query.to) : undefined;
        if ((fromDate && !toDate) || (!fromDate && toDate)) {
            throw new Error("Both from and to dates are required");
        }
        if (fromDate && toDate) {
            ensureValidRange(fromDate, toDate);
        }
        if (!query.employeeId) {
            const { limit, cursor } = (0, cursor_pagination_util_1.getCursorPagination)(query);
            const attendance = await attendance_repository_1.AttendanceRepository.list({
                take: limit + 1,
                ...(cursor && { cursor }),
                ...(query.status && { status: query.status }),
                ...(fromDate && { from: fromDate }),
                ...(toDate && { to: toDate }),
            });
            return (0, cursor_pagination_util_1.buildCursorPaginationMeta)(attendance, limit);
        }
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [attendance, total] = await attendance_repository_1.AttendanceRepository.listWithCount({
            skip,
            take,
            employeeId: query.employeeId,
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
        ensureSundayAttendanceIsOtOnly(attendanceDate, data);
        const existing = await attendance_repository_1.AttendanceRepository.findByEmployeeAndDate(data.employeeId, attendanceDate);
        if (existing) {
            throw new Error("Attendance already exists for this employee on this date");
        }
        const attendance = await attendance_repository_1.AttendanceRepository.create({
            employeeId: data.employeeId,
            date: attendanceDate,
            status: data.status,
            ...(await buildAttendancePayload(attendanceDate, data)),
        });
        invalidateAttendanceCaches();
        return attendance;
    }
    static async bulkAttendance(records, currentUserRole) {
        const seen = new Set();
        const normalizedInput = [];
        const existingDatesByEmployee = new Map();
        for (const record of records) {
            const key = `${record.employeeId}_${record.date}`;
            if (seen.has(key)) {
                throw new Error(`Duplicate attendance record in request body for employee ${record.employeeId} on ${record.date}`);
            }
            seen.add(key);
            normalizedInput.push({
                employeeId: record.employeeId,
                attendanceDate: normalizeDate(record.date),
                status: record.status,
                input: record,
            });
        }
        const employeeIds = [
            ...new Set(normalizedInput.map((item) => item.employeeId)),
        ];
        const { minDate, maxDate } = getDateBounds(normalizedInput.map((item) => item.attendanceDate));
        const [employees, existingAttendances, activePayrolls] = await Promise.all([
            attendance_repository_1.AttendanceRepository.findEmployeesByIds(employeeIds),
            attendance_repository_1.AttendanceRepository.findByEmployeeAndDates(normalizedInput.map((item) => ({
                employeeId: item.employeeId,
                date: item.attendanceDate,
            }))),
            attendance_repository_1.AttendanceRepository.findActivePayrollLocks({
                employeeIds,
                minDate,
                maxDate,
            }),
        ]);
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
        const existingMap = new Map(existingAttendances.map((attendance) => [
            attendanceKey(attendance.employeeId, attendance.date),
            attendance,
        ]));
        const recordsToCreate = [];
        for (const record of normalizedInput) {
            const employee = employeeMap.get(record.employeeId);
            if (!employee) {
                throw new Error(`Employee not found: ${record.employeeId}`);
            }
            if (employee.status !== "ACTIVE") {
                throw new Error(`Cannot mark attendance for inactive employee: ${employee.employeeCode}`);
            }
            ensureAllowedEmployeeAccess(employee.role, currentUserRole);
            const attendanceDate = record.attendanceDate;
            ensureNotFutureDate(attendanceDate);
            ensureDateOnOrAfterJoining({
                date: attendanceDate,
                joiningDate: employee.joiningDate,
                action: `Attendance date for ${employee.employeeCode}`,
            });
            assertNotLockedFromPreloadedPayrolls(record.employeeId, attendanceDate, activePayrolls);
            ensureSundayAttendanceIsOtOnly(attendanceDate, record.input);
            const existing = existingMap.get(attendanceKey(record.employeeId, attendanceDate));
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
            else {
                recordsToCreate.push(record);
            }
        }
        const settings = recordsToCreate.length > 0
            ? await overtime_service_1.OvertimeService.getSettingsForDateRange(minDate, maxDate)
            : [];
        const createPayloads = await Promise.all(recordsToCreate.map(async (record) => ({
            employeeId: record.employeeId,
            date: record.attendanceDate,
            status: record.status,
            ...(await buildAttendancePayload(record.attendanceDate, record.input, settings)),
        })));
        const results = createPayloads.length > 0
            ? await attendance_repository_1.AttendanceRepository.createMany(createPayloads)
            : [];
        if (results.length > 0) {
            invalidateAttendanceCaches();
        }
        const conflicts = [...existingDatesByEmployee.values()].map((item) => `${item.employeeCode}: ${formatDateRanges(item.dates)}`);
        const conflictMessage = conflicts.length > 0
            ? `Attendance already exists for ${conflicts.join("; ")}`
            : null;
        return {
            createdCount: results.length,
            skippedCount: normalizedInput.length - results.length,
            records: results,
            conflictMessage,
            conflicts,
        };
    }
    static async listByEmployee(employeeId, currentUserRole, currentUserId, query) {
        if (currentUserRole === client_1.Role.USER && employeeId !== currentUserId) {
            throw new Error("USER can view only own attendance");
        }
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = attendanceReadCacheKey("employee", employeeId, page, limit);
        if (currentUserRole !== client_1.Role.USER) {
            const employee = await attendance_repository_1.AttendanceRepository.findEmployeeForRead(employeeId);
            if (!employee) {
                throw new Error("Employee not found");
            }
            ensureAllowedEmployeeAccess(employee.role, currentUserRole);
        }
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const [attendance, total] = await Promise.all([
            attendance_repository_1.AttendanceRepository.listByEmployee(employeeId, { skip, take }),
            attendance_repository_1.AttendanceRepository.countByEmployee(employeeId),
        ]);
        const result = {
            data: attendance,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, 30);
        return result;
    }
    static async listByRange(employeeId, from, to, authUser, query) {
        if (authUser.role === client_1.Role.USER && employeeId !== authUser.id) {
            throw new Error("USER can view only own attendance");
        }
        const fromDate = normalizeDate(from);
        const toDate = normalizeDate(to);
        ensureValidRange(fromDate, toDate);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = attendanceReadCacheKey("range", employeeId, formatDate(fromDate), formatDate(toDate), page, limit);
        if (authUser.role !== client_1.Role.USER) {
            const employee = await attendance_repository_1.AttendanceRepository.findEmployeeForRead(employeeId);
            if (!employee) {
                throw new Error("Employee not found");
            }
            ensureAllowedEmployeeAccess(employee.role, authUser.role);
        }
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const [attendanceRecords, total, requests] = await Promise.all([
            attendance_repository_1.AttendanceRepository.listByRange(employeeId, fromDate, toDate, {
                skip,
                take,
            }),
            attendance_repository_1.AttendanceRepository.countByRange(employeeId, fromDate, toDate),
            attendance_repository_1.AttendanceRepository.listLatestRequestsByRange(employeeId, fromDate, toDate),
        ]);
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
        const result = {
            data,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
            rangeSummary: {
                from: formatDate(fromDate),
                to: formatDate(toDate),
                returnedRecords: data.length,
                totalRecords: total,
                page,
                limit,
            },
        };
        void cache_1.CacheService.set(cacheKey, result, 30);
        return result;
    }
    static async updateAttendance(id, data, currentUserRole) {
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
        ensureSundayAttendanceIsOtOnly(attendance.date, {
            checkInTime: hasOwn(data, "checkInTime")
                ? data.checkInTime
                : attendance.checkInTime,
            checkOutTime: hasOwn(data, "checkOutTime")
                ? data.checkOutTime
                : attendance.checkOutTime,
            otStartTime: hasOwn(data, "otStartTime")
                ? data.otStartTime
                : attendance.otStartTime,
            otEndTime: hasOwn(data, "otEndTime")
                ? data.otEndTime
                : attendance.otEndTime,
            otHours: hasOwn(data, "otHours") && data.otHours !== undefined
                ? data.otHours
                : Number(attendance.otHours ?? 0),
        });
        const updatedAttendance = await attendance_repository_1.AttendanceRepository.update(id, {
            status: data.status,
            ...(await buildAttendancePayload(attendance.date, {
                checkInTime: hasOwn(data, "checkInTime")
                    ? data.checkInTime
                    : attendance.checkInTime,
                checkOutTime: hasOwn(data, "checkOutTime")
                    ? data.checkOutTime
                    : attendance.checkOutTime,
                otStartTime: hasOwn(data, "otStartTime")
                    ? data.otStartTime
                    : attendance.otStartTime,
                otEndTime: hasOwn(data, "otEndTime")
                    ? data.otEndTime
                    : attendance.otEndTime,
                otHours: hasOwn(data, "otHours") && data.otHours !== undefined
                    ? data.otHours
                    : Number(attendance.otHours ?? 0),
                otManualOverride: data.otManualOverride ?? attendance.otManualOverride ?? false,
                otOverrideReason: hasOwn(data, "otOverrideReason")
                    ? data.otOverrideReason
                    : attendance.otOverrideReason ?? null,
            })),
        });
        invalidateAttendanceCaches();
        return updatedAttendance;
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
        const deletedAttendance = await attendance_repository_1.AttendanceRepository.delete(id);
        invalidateAttendanceCaches();
        return deletedAttendance;
    }
    static async bulkUpdateAttendance(records, currentUserRole) {
        const seen = new Set();
        const normalizedRecords = [];
        for (const record of records) {
            if (seen.has(record.attendanceId)) {
                throw new Error(`Duplicate attendanceId in request: ${record.attendanceId}`);
            }
            seen.add(record.attendanceId);
        }
        const attendanceIds = records.map((record) => record.attendanceId);
        const attendances = await attendance_repository_1.AttendanceRepository.findManyByIdsForWrite(attendanceIds);
        const attendanceMap = new Map(attendances.map((attendance) => [attendance.id, attendance]));
        const missingId = attendanceIds.find((id) => !attendanceMap.has(id));
        if (missingId) {
            throw new Error(`Attendance record not found: ${missingId}`);
        }
        const { minDate, maxDate } = getDateBounds(attendances.map((attendance) => attendance.date));
        const employeeIds = [
            ...new Set(attendances.map((attendance) => attendance.employeeId)),
        ];
        const [activePayrolls, settings] = await Promise.all([
            attendance_repository_1.AttendanceRepository.findActivePayrollLocks({
                employeeIds,
                minDate,
                maxDate,
            }),
            overtime_service_1.OvertimeService.getSettingsForDateRange(minDate, maxDate),
        ]);
        const payloadPromises = records.map(async (record) => {
            const attendance = attendanceMap.get(record.attendanceId);
            ensureAllowedEmployeeAccess(attendance.employee.role, currentUserRole);
            ensureNotFutureDate(attendance.date);
            ensureDateOnOrAfterJoining({
                date: attendance.date,
                joiningDate: attendance.employee.joiningDate,
                action: "Attendance date",
            });
            assertNotLockedFromPreloadedPayrolls(attendance.employeeId, attendance.date, activePayrolls);
            ensureSundayAttendanceIsOtOnly(attendance.date, {
                checkInTime: hasOwn(record, "checkInTime")
                    ? record.checkInTime
                    : attendance.checkInTime,
                checkOutTime: hasOwn(record, "checkOutTime")
                    ? record.checkOutTime
                    : attendance.checkOutTime,
                otStartTime: hasOwn(record, "otStartTime")
                    ? record.otStartTime
                    : attendance.otStartTime,
                otEndTime: hasOwn(record, "otEndTime")
                    ? record.otEndTime
                    : attendance.otEndTime,
                otHours: hasOwn(record, "otHours") && record.otHours !== undefined
                    ? record.otHours
                    : Number(attendance.otHours ?? 0),
            });
            return {
                attendanceId: record.attendanceId,
                status: record.status,
                ...(await buildAttendancePayload(attendance.date, {
                    checkInTime: hasOwn(record, "checkInTime")
                        ? record.checkInTime
                        : attendance.checkInTime,
                    checkOutTime: hasOwn(record, "checkOutTime")
                        ? record.checkOutTime
                        : attendance.checkOutTime,
                    otStartTime: hasOwn(record, "otStartTime")
                        ? record.otStartTime
                        : attendance.otStartTime,
                    otEndTime: hasOwn(record, "otEndTime")
                        ? record.otEndTime
                        : attendance.otEndTime,
                    otHours: hasOwn(record, "otHours") && record.otHours !== undefined
                        ? record.otHours
                        : Number(attendance.otHours ?? 0),
                    otManualOverride: record.otManualOverride ??
                        attendance.otManualOverride ??
                        false,
                    otOverrideReason: hasOwn(record, "otOverrideReason")
                        ? record.otOverrideReason
                        : attendance.otOverrideReason ?? null,
                }, settings)),
            };
        });
        normalizedRecords.push(...(await Promise.all(payloadPromises)));
        const updatedAttendances = await attendance_repository_1.AttendanceRepository.updateMany(normalizedRecords);
        invalidateAttendanceCaches();
        return updatedAttendances;
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
        }
        const attendances = await attendance_repository_1.AttendanceRepository.findManyByIdsForWrite(attendanceIds);
        if (attendances.length !== attendanceIds.length) {
            const attendanceMap = new Map(attendances.map((attendance) => [attendance.id, attendance]));
            const missingId = attendanceIds.find((id) => !attendanceMap.has(id));
            throw new Error(`Attendance record not found: ${missingId}`);
        }
        const { minDate, maxDate } = getDateBounds(attendances.map((attendance) => attendance.date));
        const activePayrolls = await attendance_repository_1.AttendanceRepository.findActivePayrollLocks({
            employeeIds: [
                ...new Set(attendances.map((attendance) => attendance.employeeId)),
            ],
            minDate,
            maxDate,
        });
        for (const attendance of attendances) {
            assertNotLockedFromPreloadedPayrolls(attendance.employeeId, attendance.date, activePayrolls);
        }
        await attendance_repository_1.AttendanceRepository.deleteMany(attendanceIds);
        invalidateAttendanceCaches();
        return attendances;
    }
}
exports.AttendanceService = AttendanceService;
//# sourceMappingURL=attendance.service.js.map