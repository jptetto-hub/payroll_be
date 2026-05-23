import { AttendanceStatus, Role } from "@prisma/client";
import { AttendanceRepository } from "./attendance.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import {
  buildCursorPaginationMeta,
  getCursorPagination,
} from "../../shared/utils/cursor-pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { assertAttendanceNotLocked } from "../../shared/payroll/payroll-lock.util";
import { OvertimeService } from "../../services/overtime.service";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const ensureDateOnOrAfterJoining = (params: {
  date: Date;
  joiningDate: Date;
  action: string;
}) => {
  if (formatDate(params.date) < formatDate(params.joiningDate)) {
    throw new Error(
      `${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`,
    );
  }
};

const ensureNotFutureDate = (date: Date) => {
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  if (date > todayUtc) {
    throw new Error("Future attendance is not allowed");
  }
};

const ensureValidRange = (fromDate: Date, toDate: Date) => {
  if (fromDate > toDate) {
    throw new Error("From date cannot be greater than To date");
  }

  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 366) {
    throw new Error("Date range cannot exceed 366 days");
  }
};

const ensureAllowedEmployeeAccess = (
  targetEmployeeRole: Role,
  currentUserRole: Role,
) => {
  if (currentUserRole === Role.ADMIN && targetEmployeeRole !== Role.USER) {
    throw new Error("ADMIN can manage attendance only for USER employees");
  }
};

type AttendanceOtInput = {
  checkInTime?: string | Date | null;
  checkOutTime?: string | Date | null;
  otStartTime?: string | Date | null;
  otEndTime?: string | Date | null;
  otHours?: number | null;
  otManualOverride?: boolean;
  otOverrideReason?: string | null;
};

const parseOptionalDateTime = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date-time value");
  }

  return parsed;
};

const buildAttendancePayload = async (
  attendanceDate: Date,
  input: AttendanceOtInput,
) => {
  const checkInTime = parseOptionalDateTime(input.checkInTime);
  const checkOutTime = parseOptionalDateTime(input.checkOutTime);
  const otStartTime = parseOptionalDateTime(input.otStartTime);
  const otEndTime = parseOptionalDateTime(input.otEndTime);
    const ot = await OvertimeService.calculateForAttendance({
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
  });

  return {
    checkInTime,
    checkOutTime,
    ...ot,
  };
};

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const getOrdinalDay = (day: number) => {
  if (day > 3 && day < 21) return `${day}th`;

  const suffix = ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${suffix}`;
};

const formatMonth = (date: Date) =>
  date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

const formatDateRange = (start: Date, end: Date) => {
  const startDay = getOrdinalDay(start.getUTCDate());
  const endDay = getOrdinalDay(end.getUTCDate());
  const startMonth = formatMonth(start);
  const endMonth = formatMonth(end);

  if (start.getTime() === end.getTime()) {
    return `${startDay} of ${startMonth}`;
  }

  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth()
  ) {
    return `${startDay} to ${endDay} of ${startMonth}`;
  }

  return `${startDay} of ${startMonth} to ${endDay} of ${endMonth}`;
};

const formatDateRanges = (dates: Date[]) => {
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const ranges: string[] = [];

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

export class AttendanceService {
  static async list(query: any, currentUserRole: Role) {
    if (currentUserRole === Role.USER) {
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
      const { limit, cursor } = getCursorPagination(query);
      const attendance = await AttendanceRepository.list({
        take: limit + 1,
        ...(cursor && { cursor }),
        ...(query.status && { status: query.status }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      });

      return buildCursorPaginationMeta(attendance, limit);
    }

    const { page, limit, skip, take } = getPagination(query);
    const [attendance, total] = await AttendanceRepository.listWithCount({
      skip,
      take,
      employeeId: query.employeeId,
      ...(query.status && { status: query.status }),
      ...(fromDate && { from: fromDate }),
      ...(toDate && { to: toDate }),
    });

    return {
      data: attendance,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async createAttendance(
    data: {
      employeeId: string;
      date: string;
      status: AttendanceStatus;
    } & AttendanceOtInput,
    currentUserRole: Role,
  ) {
    const employee = await AttendanceRepository.findEmployee(data.employeeId);

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
    await assertAttendanceNotLocked(data.employeeId, attendanceDate);

    const existing = await AttendanceRepository.findByEmployeeAndDate(
      data.employeeId,
      attendanceDate,
    );

    if (existing) {
      throw new Error(
        "Attendance already exists for this employee on this date",
      );
    }

    return AttendanceRepository.create({
      employeeId: data.employeeId,
      date: attendanceDate,
      status: data.status,
      ...(await buildAttendancePayload(attendanceDate, data)),
    });
  }

  static async bulkAttendance(
    records: ({
      employeeId: string;
      date: string;
      status: AttendanceStatus;
    } & AttendanceOtInput)[],
    currentUserRole: Role,
  ) {
    const seen = new Set<string>();
    const normalizedRecords: {
      employeeId: string;
      attendanceDate: Date;
      status: AttendanceStatus;
      hasExistingAttendance: boolean;
      otPayload: Awaited<ReturnType<typeof buildAttendancePayload>>;
    }[] = [];
    const existingDatesByEmployee = new Map<
      string,
      { employeeCode: string; dates: Date[] }
    >();

    for (const record of records) {
      const key = `${record.employeeId}_${record.date}`;

      if (seen.has(key)) {
        throw new Error(
          `Duplicate attendance record in request body for employee ${record.employeeId} on ${record.date}`,
        );
      }

      seen.add(key);
    }

    for (const record of records) {
      const employee = await AttendanceRepository.findEmployee(
        record.employeeId,
      );

      if (!employee) {
        throw new Error(`Employee not found: ${record.employeeId}`);
      }

      if (employee.status !== "ACTIVE") {
        throw new Error(
          `Cannot mark attendance for inactive employee: ${employee.employeeCode}`,
        );
      }

      ensureAllowedEmployeeAccess(employee.role, currentUserRole);

      const attendanceDate = normalizeDate(record.date);
      ensureNotFutureDate(attendanceDate);
      ensureDateOnOrAfterJoining({
        date: attendanceDate,
        joiningDate: employee.joiningDate,
        action: `Attendance date for ${employee.employeeCode}`,
      });
      await assertAttendanceNotLocked(record.employeeId, attendanceDate);

      const existing = await AttendanceRepository.findByEmployeeAndDate(
        record.employeeId,
        attendanceDate,
      );

      if (existing) {
        const existingDates = existingDatesByEmployee.get(record.employeeId);

        if (existingDates) {
          existingDates.dates.push(attendanceDate);
        } else {
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
        otPayload: await buildAttendancePayload(attendanceDate, record),
      });
    }

    const results = [];

    for (const record of normalizedRecords.filter(
      (item) => !item.hasExistingAttendance,
    )) {
      const saved = await AttendanceRepository.create({
        employeeId: record.employeeId,
        date: record.attendanceDate,
        status: record.status,
        ...record.otPayload,
      });

      results.push(saved);
    }

    const conflicts = [...existingDatesByEmployee.values()].map(
      (item) => `${item.employeeCode}: ${formatDateRanges(item.dates)}`,
    );
    const conflictMessage =
      conflicts.length > 0
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

  static async listByEmployee(
    employeeId: string,
    currentUserRole: Role,
    currentUserId: string,
    query: any,
  ) {
    if (currentUserRole === Role.USER && employeeId !== currentUserId) {
      throw new Error("USER can view only own attendance");
    }

    const employee = await AttendanceRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureAllowedEmployeeAccess(employee.role, currentUserRole);

    const { page, limit, skip, take } = getPagination(query);
    const [attendance, total] = await Promise.all([
      AttendanceRepository.listByEmployee(employeeId, { skip, take }),
      AttendanceRepository.countByEmployee(employeeId),
    ]);

    return {
      data: attendance,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async listByRange(
    employeeId: string,
    from: string,
    to: string,
    authUser: { id: string; role: Role },
    query: any,
  ) {
    const { employeeWhere } = resolveEmployeeScope({ authUser, employeeId });

    const fromDate = normalizeDate(from);
    const toDate = normalizeDate(to);

    ensureValidRange(fromDate, toDate);

    const { page, limit, skip, take } = getPagination(query);
    const [attendanceRecords, total] = await Promise.all([
      AttendanceRepository.listByRange(employeeWhere, fromDate, toDate, {
        skip,
        take,
      }),
      AttendanceRepository.countByRange(employeeWhere, fromDate, toDate),
    ]);

    const requests = await AttendanceRepository.listLatestRequestsByRange(
      employeeWhere,
      fromDate,
      toDate,
    );

    const latestRequestMap = new Map<string, any>();

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
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async updateAttendance(
    id: string,
    data: { status: AttendanceStatus } & AttendanceOtInput,
    currentUserRole: Role,
  ) {
    const attendance = await AttendanceRepository.findById(id);

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
    await assertAttendanceNotLocked(attendance.employeeId, attendance.date);

    return AttendanceRepository.update(id, {
      status: data.status,
      ...(await buildAttendancePayload(attendance.date, {
        checkInTime: hasOwn(data, "checkInTime")
          ? data.checkInTime
          : (attendance as any).checkInTime,
        checkOutTime: hasOwn(data, "checkOutTime")
          ? data.checkOutTime
          : (attendance as any).checkOutTime,
        otStartTime: hasOwn(data, "otStartTime")
          ? data.otStartTime
          : (attendance as any).otStartTime,
        otEndTime: hasOwn(data, "otEndTime")
          ? data.otEndTime
          : (attendance as any).otEndTime,
        otHours: hasOwn(data, "otHours") && data.otHours !== undefined
          ? data.otHours
          : Number((attendance as any).otHours ?? 0),
        otManualOverride:
          data.otManualOverride ?? (attendance as any).otManualOverride ?? false,
        otOverrideReason:
          hasOwn(data, "otOverrideReason")
            ? data.otOverrideReason
            : (attendance as any).otOverrideReason ?? null,
      })),
    });
  }

  static async deleteAttendance(id: string, currentUserRole: Role) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can delete attendance");
    }

    const attendance = await AttendanceRepository.findById(id);

    if (!attendance) {
      throw new Error("Attendance record not found");
    }

    await assertAttendanceNotLocked(attendance.employeeId, attendance.date);

    return AttendanceRepository.delete(id);
  }

  static async bulkUpdateAttendance(
    records: ({
      attendanceId: string;
      status: AttendanceStatus;
      reason: string;
    } & AttendanceOtInput)[],
    currentUserRole: Role,
  ) {
    const seen = new Set<string>();
    const normalizedRecords: ({
      attendanceId: string;
      status: AttendanceStatus;
    } & Awaited<ReturnType<typeof buildAttendancePayload>>)[] = [];

    for (const record of records) {
      if (seen.has(record.attendanceId)) {
        throw new Error(
          `Duplicate attendanceId in request: ${record.attendanceId}`,
        );
      }

      seen.add(record.attendanceId);

      const attendance = await AttendanceRepository.findById(
        record.attendanceId,
      );

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
      await assertAttendanceNotLocked(attendance.employeeId, attendance.date);

      normalizedRecords.push({
        attendanceId: record.attendanceId,
        status: record.status,
        ...(await buildAttendancePayload(attendance.date, {
          checkInTime: hasOwn(record, "checkInTime")
            ? record.checkInTime
            : (attendance as any).checkInTime,
          checkOutTime: hasOwn(record, "checkOutTime")
            ? record.checkOutTime
            : (attendance as any).checkOutTime,
          otStartTime: hasOwn(record, "otStartTime")
            ? record.otStartTime
            : (attendance as any).otStartTime,
          otEndTime: hasOwn(record, "otEndTime")
            ? record.otEndTime
            : (attendance as any).otEndTime,
          otHours: hasOwn(record, "otHours") && record.otHours !== undefined
            ? record.otHours
            : Number((attendance as any).otHours ?? 0),
          otManualOverride:
            record.otManualOverride ??
            (attendance as any).otManualOverride ??
            false,
          otOverrideReason:
            hasOwn(record, "otOverrideReason")
              ? record.otOverrideReason
              : (attendance as any).otOverrideReason ?? null,
        })),
      });
    }

    return AttendanceRepository.updateMany(normalizedRecords);
  }

  static async bulkDeleteAttendance(
    attendanceIds: string[],
    currentUserRole: Role,
    reason: string,
  ) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can bulk delete attendance");
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error("Delete reason is required");
    }

    const seen = new Set<string>();

    for (const attendanceId of attendanceIds) {
      if (seen.has(attendanceId)) {
        throw new Error(`Duplicate attendanceId in request: ${attendanceId}`);
      }

      seen.add(attendanceId);

      const attendance = await AttendanceRepository.findById(attendanceId);

      if (!attendance) {
        throw new Error(`Attendance record not found: ${attendanceId}`);
      }

      await assertAttendanceNotLocked(attendance.employeeId, attendance.date);
    }

    return AttendanceRepository.deleteMany(attendanceIds);
  }
}
