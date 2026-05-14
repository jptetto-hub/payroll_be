"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSalaryHistoryNotLocked = exports.assertAdvanceCycleNotLocked = exports.assertAttendanceApprovalNotLocked = exports.assertAttendanceNotLocked = exports.findActivePayrollForCycle = exports.findActivePayrollForDate = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const app_error_1 = require("../utils/app-error");
const ACTIVE_LOCK_STATUSES = [
    client_1.PayrollStatus.GENERATED,
    client_1.PayrollStatus.PAID,
];
const findActivePayrollForDate = async (employeeId, date) => {
    return prisma_1.prisma.payroll.findFirst({
        where: {
            employeeId,
            status: {
                in: ACTIVE_LOCK_STATUSES,
            },
            periodStart: {
                lte: date,
            },
            periodEnd: {
                gte: date,
            },
        },
    });
};
exports.findActivePayrollForDate = findActivePayrollForDate;
const findActivePayrollForCycle = async ({ employeeId, cycleStartDate, cycleEndDate, }) => {
    return prisma_1.prisma.payroll.findFirst({
        where: {
            employeeId,
            status: {
                in: ACTIVE_LOCK_STATUSES,
            },
            periodStart: cycleStartDate,
            periodEnd: cycleEndDate,
        },
    });
};
exports.findActivePayrollForCycle = findActivePayrollForCycle;
const assertAttendanceNotLocked = async (employeeId, date) => {
    const payroll = await (0, exports.findActivePayrollForDate)(employeeId, date);
    if (payroll) {
        throw new app_error_1.AppError("Attendance is locked because payroll is already generated for this period. Cancel or recalculate payroll before editing.", 400);
    }
};
exports.assertAttendanceNotLocked = assertAttendanceNotLocked;
const assertAttendanceApprovalNotLocked = async (employeeId, date) => {
    const payroll = await (0, exports.findActivePayrollForDate)(employeeId, date);
    if (payroll) {
        throw new app_error_1.AppError("Cannot approve attendance request because payroll already exists for this attendance period. Cancel or recalculate payroll first.", 400);
    }
};
exports.assertAttendanceApprovalNotLocked = assertAttendanceApprovalNotLocked;
const assertAdvanceCycleNotLocked = async ({ employeeId, cycleStartDate, cycleEndDate, }) => {
    const payroll = await (0, exports.findActivePayrollForCycle)({
        employeeId,
        cycleStartDate,
        cycleEndDate,
    });
    if (payroll) {
        throw new app_error_1.AppError("Advance is locked because payroll is already generated for this deduction cycle. Cancel payroll before editing advance.", 400);
    }
};
exports.assertAdvanceCycleNotLocked = assertAdvanceCycleNotLocked;
const assertSalaryHistoryNotLocked = async ({ employeeId, effectiveFrom, }) => {
    const payroll = await (0, exports.findActivePayrollForDate)(employeeId, effectiveFrom);
    if (payroll) {
        throw new app_error_1.AppError("Salary history is locked because payroll already exists for the affected period. Use payroll recalculation workflow.", 400);
    }
};
exports.assertSalaryHistoryNotLocked = assertSalaryHistoryNotLocked;
//# sourceMappingURL=payroll-lock.util.js.map