"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const reports_repository_1 = require("./reports.repository");
const csv_1 = require("../../utils/export/csv");
const excel_1 = require("../../utils/export/excel");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const app_error_1 = require("../../shared/utils/app-error");
const parseFromDate = (value) => value ? new Date(`${value}T00:00:00.000Z`) : undefined;
const parseToDate = (value) => value ? new Date(`${value}T23:59:59.999Z`) : undefined;
const MAX_REPORT_RANGE_DAYS = Number(process.env.REPORT_MAX_RANGE_DAYS || 31);
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const normalizeReportQuery = (query, authUser, paginate = true) => {
    const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
        authUser,
        employeeId: query.employeeId,
    });
    let pagination;
    try {
        pagination = (0, pagination_util_1.getPagination)(query);
    }
    catch {
        throw new app_error_1.AppError("Invalid pagination parameters", 400);
    }
    const fromDate = parseFromDate(query.from);
    const toDate = parseToDate(query.to);
    if (!fromDate || !toDate) {
        throw new app_error_1.AppError("from and to date are required for report APIs", 400);
    }
    if (fromDate && Number.isNaN(fromDate.getTime())) {
        throw new app_error_1.AppError("Invalid from date. Use YYYY-MM-DD", 400);
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
        throw new app_error_1.AppError("Invalid to date. Use YYYY-MM-DD", 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
        throw new app_error_1.AppError("from date cannot be greater than to date", 400);
    }
    const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
    if (rangeDays > MAX_REPORT_RANGE_DAYS) {
        throw new app_error_1.AppError(`Report date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`, 400);
    }
    return {
        employeeWhere,
        fromDate,
        toDate,
        page: pagination.page,
        limit: pagination.limit,
        skip: pagination.skip,
        take: pagination.take,
        paginate,
    };
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const salaryExportColumns = [
    { header: "Employee Code", key: "employeeCode", width: 18 },
    { header: "Name", key: "name", width: 25 },
    { header: "Salary Type", key: "salaryType", width: 15 },
    { header: "Period Start", key: "periodStart", width: 15 },
    { header: "Period End", key: "periodEnd", width: 15 },
    { header: "Standard Salary", key: "standardSalary", width: 18 },
    { header: "OT Hours", key: "otTotalHours", width: 12 },
    { header: "OT Hourly Rate", key: "otHourlyRate", width: 18 },
    { header: "OT Earnings", key: "otEarnings", width: 15 },
    { header: "Gross Salary", key: "grossSalary", width: 15 },
    { header: "Advance Deduction", key: "advanceDeduction", width: 20 },
    { header: "Carry Forward Applied", key: "carryForwardApplied", width: 24 },
    { header: "Total Deduction", key: "totalDeduction", width: 18 },
    { header: "Raw Final Salary", key: "rawFinalSalary", width: 18 },
    { header: "Final Salary", key: "finalSalary", width: 15 },
    {
        header: "Carry Forward Deduction",
        key: "carryForwardDeduction",
        width: 26,
    },
    { header: "Payroll Status", key: "payrollStatus", width: 18 },
];
const allInOneExportColumns = [
    { header: "Employee Code", key: "employeeCode", width: 18 },
    { header: "Name", key: "name", width: 25 },
    { header: "Salary Type", key: "salaryType", width: 15 },
    { header: "Period Start", key: "periodStart", width: 15 },
    { header: "Period End", key: "periodEnd", width: 15 },
    { header: "Standard Salary", key: "standardSalary", width: 18 },
    { header: "OT Hours", key: "otTotalHours", width: 12 },
    { header: "OT Hourly Rate", key: "otHourlyRate", width: 18 },
    { header: "OT Earnings", key: "otEarnings", width: 15 },
    { header: "Gross Salary", key: "grossSalary", width: 15 },
    { header: "Advance Deduction", key: "advanceDeduction", width: 20 },
    { header: "Advance Deduction Mode", key: "advanceDeductionMode", width: 26 },
    { header: "Manual Deduction Amount", key: "manualDeductionAmount", width: 26 },
    { header: "Manual Pending Balance", key: "manualPendingBalance", width: 26 },
    { header: "Carry Forward Applied", key: "carryForwardApplied", width: 24 },
    { header: "Total Deduction", key: "totalDeduction", width: 18 },
    { header: "Raw Final Salary", key: "rawFinalSalary", width: 18 },
    { header: "Final Salary", key: "finalSalary", width: 15 },
    {
        header: "Carry Forward Deduction",
        key: "carryForwardDeduction",
        width: 26,
    },
    { header: "Payroll Status", key: "payrollStatus", width: 18 },
];
const salaryExportKeys = [
    "employeeCode",
    "name",
    "salaryType",
    "periodStart",
    "periodEnd",
    "standardSalary",
    "otTotalHours",
    "otHourlyRate",
    "otEarnings",
    "grossSalary",
    "advanceDeduction",
    "carryForwardApplied",
    "totalDeduction",
    "rawFinalSalary",
    "finalSalary",
    "carryForwardDeduction",
    "payrollStatus",
];
const allInOneExportKeys = [
    "employeeCode",
    "name",
    "salaryType",
    "periodStart",
    "periodEnd",
    "standardSalary",
    "otTotalHours",
    "otHourlyRate",
    "otEarnings",
    "grossSalary",
    "advanceDeduction",
    "advanceDeductionMode",
    "manualDeductionAmount",
    "manualPendingBalance",
    "carryForwardApplied",
    "totalDeduction",
    "rawFinalSalary",
    "finalSalary",
    "carryForwardDeduction",
    "payrollStatus",
];
const getAdvanceBreakdown = (p) => p.advanceBreakdown ?? {};
const getAdvanceDeductionMode = (p) => getAdvanceBreakdown(p).advanceDeductionMode ??
    p.employee?.advanceDeductionMode ??
    "AUTO";
const getManualDeductionAmount = (p) => Number(getAdvanceBreakdown(p).manualDeductionAmount ?? p.advanceDeduction ?? 0);
const getManualPendingBalance = (p) => {
    const breakdown = getAdvanceBreakdown(p);
    const outstanding = Number(breakdown.manualOutstandingTotal ?? 0);
    const deduction = Number(p.advanceDeduction ?? 0);
    return Math.max(outstanding - deduction, 0);
};
const formatPayrollForExport = (p) => ({
    employeeCode: p.employee.employeeCode,
    name: p.employee.name,
    salaryType: p.employee.salaryType,
    periodStart: formatDate(p.periodStart),
    periodEnd: formatDate(p.periodEnd),
    standardSalary: Number(p.standardSalary ?? p.grossSalary),
    otTotalHours: Number(p.otTotalHours ?? 0),
    otHourlyRate: Number(p.otHourlyRate ?? 0),
    otEarnings: Number(p.otEarnings ?? 0),
    grossSalary: Number(p.grossSalary),
    advanceDeduction: Number(p.advanceDeduction),
    advanceDeductionMode: getAdvanceDeductionMode(p),
    manualDeductionAmount: getAdvanceDeductionMode(p) === "MANUAL" ? getManualDeductionAmount(p) : 0,
    manualPendingBalance: getAdvanceDeductionMode(p) === "MANUAL" ? getManualPendingBalance(p) : 0,
    carryForwardApplied: Number(p.carryForwardApplied),
    totalDeduction: Number(p.totalDeduction),
    rawFinalSalary: Number(p.rawFinalSalary),
    finalSalary: Number(p.finalSalary),
    carryForwardDeduction: Number(p.carryForwardDeduction),
    payrollStatus: p.status,
});
const formatAllInOne = (p) => ({
    employeeCode: p.employee.employeeCode,
    name: p.employee.name,
    salaryType: p.employee.salaryType,
    periodStart: formatDate(p.periodStart),
    periodEnd: formatDate(p.periodEnd),
    standardSalary: Number(p.standardSalary ?? p.grossSalary),
    otTotalHours: Number(p.otTotalHours ?? 0),
    otHourlyRate: Number(p.otHourlyRate ?? 0),
    otEarnings: Number(p.otEarnings ?? 0),
    grossSalary: Number(p.grossSalary),
    advanceDeduction: Number(p.advanceDeduction),
    advanceDeductionMode: getAdvanceDeductionMode(p),
    manualDeductionAmount: getAdvanceDeductionMode(p) === "MANUAL" ? getManualDeductionAmount(p) : 0,
    manualPendingBalance: getAdvanceDeductionMode(p) === "MANUAL" ? getManualPendingBalance(p) : 0,
    carryForwardApplied: Number(p.carryForwardApplied),
    totalDeduction: Number(p.totalDeduction),
    rawFinalSalary: Number(p.rawFinalSalary),
    finalSalary: Number(p.finalSalary),
    carryForwardDeduction: Number(p.carryForwardDeduction),
    payrollStatus: p.status,
});
class ReportsService {
    static async salary(query, authUser) {
        return reports_repository_1.ReportsRepository.salaryReport(normalizeReportQuery(query, authUser));
    }
    static async salaryExport(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.salaryReport(normalizeReportQuery(query, authUser, false));
        return (0, csv_1.generateCSV)(result.data.map(formatPayrollForExport), salaryExportKeys);
    }
    static async attendance(query, authUser) {
        return reports_repository_1.ReportsRepository.attendanceReport(normalizeReportQuery(query, authUser));
    }
    static async attendanceExport(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.attendanceReport(normalizeReportQuery(query, authUser, false));
        const formatted = result.data.map((a) => ({
            employeeCode: a.employee.employeeCode,
            name: a.employee.name,
            salaryType: a.employee.salaryType,
            date: formatDate(a.date),
            status: a.status,
            otHours: Number(a.otHours ?? 0),
        }));
        return (0, csv_1.generateCSV)(formatted, [
            "employeeCode",
            "name",
            "salaryType",
            "date",
            "status",
            "otHours",
        ]);
    }
    static async advance(query, authUser) {
        return reports_repository_1.ReportsRepository.advanceReport(normalizeReportQuery(query, authUser));
    }
    static async advanceExport(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.advanceReport(normalizeReportQuery(query, authUser, false));
        const formatted = result.data.map((a) => ({
            employeeCode: a.employee.employeeCode,
            name: a.employee.name,
            salaryType: a.employee.salaryType,
            advanceDeductionMode: a.employee.advanceDeductionMode,
            amount: Number(a.amount),
            remainingAmount: Number(a.remainingAmount),
            settledAmount: Number(a.settledAmount),
            carryForwardAmount: Number(a.carryForwardAmount),
            settlementStatus: a.settlementStatus,
            lockedByPayrollId: a.lockedByPayrollId,
            date: formatDate(a.date),
            payCycleType: a.payCycleType,
            cycleStartDate: formatDate(a.cycleStartDate),
            cycleEndDate: formatDate(a.cycleEndDate),
            isSettled: a.isSettled ? "Yes" : "No",
        }));
        return (0, csv_1.generateCSV)(formatted, [
            "employeeCode",
            "name",
            "salaryType",
            "advanceDeductionMode",
            "amount",
            "remainingAmount",
            "settledAmount",
            "carryForwardAmount",
            "settlementStatus",
            "lockedByPayrollId",
            "date",
            "payCycleType",
            "cycleStartDate",
            "cycleEndDate",
            "isSettled",
        ]);
    }
    static async salaryExportExcel(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.salaryReport(normalizeReportQuery(query, authUser, false));
        return (0, excel_1.generateExcelBuffer)("Salary Report", salaryExportColumns, result.data.map(formatPayrollForExport));
    }
    static async attendanceExportExcel(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.attendanceReport(normalizeReportQuery(query, authUser, false));
        const formatted = result.data.map((a) => ({
            employeeCode: a.employee.employeeCode,
            name: a.employee.name,
            salaryType: a.employee.salaryType,
            date: formatDate(a.date),
            status: a.status,
            otHours: Number(a.otHours ?? 0),
        }));
        return (0, excel_1.generateExcelBuffer)("Attendance Report", [
            { header: "Employee Code", key: "employeeCode", width: 18 },
            { header: "Name", key: "name", width: 25 },
            { header: "Salary Type", key: "salaryType", width: 15 },
            { header: "Date", key: "date", width: 15 },
            { header: "Status", key: "status", width: 15 },
            { header: "OT Hours", key: "otHours", width: 12 },
        ], formatted);
    }
    static async advanceExportExcel(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.advanceReport(normalizeReportQuery(query, authUser, false));
        const formatted = result.data.map((a) => ({
            employeeCode: a.employee.employeeCode,
            name: a.employee.name,
            salaryType: a.employee.salaryType,
            advanceDeductionMode: a.employee.advanceDeductionMode,
            amount: Number(a.amount),
            remainingAmount: Number(a.remainingAmount),
            settledAmount: Number(a.settledAmount),
            carryForwardAmount: Number(a.carryForwardAmount),
            settlementStatus: a.settlementStatus,
            lockedByPayrollId: a.lockedByPayrollId,
            date: formatDate(a.date),
            payCycleType: a.payCycleType,
            cycleStartDate: formatDate(a.cycleStartDate),
            cycleEndDate: formatDate(a.cycleEndDate),
            isSettled: a.isSettled ? "Yes" : "No",
        }));
        return (0, excel_1.generateExcelBuffer)("Advance Report", [
            { header: "Employee Code", key: "employeeCode", width: 18 },
            { header: "Name", key: "name", width: 25 },
            { header: "Salary Type", key: "salaryType", width: 15 },
            { header: "Advance Deduction Mode", key: "advanceDeductionMode", width: 26 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Remaining Amount", key: "remainingAmount", width: 20 },
            { header: "Settled Amount", key: "settledAmount", width: 18 },
            { header: "Carry Forward Amount", key: "carryForwardAmount", width: 24 },
            { header: "Settlement Status", key: "settlementStatus", width: 22 },
            { header: "Locked By Payroll", key: "lockedByPayrollId", width: 38 },
            { header: "Date", key: "date", width: 15 },
            { header: "Pay Cycle Type", key: "payCycleType", width: 18 },
            { header: "Cycle Start Date", key: "cycleStartDate", width: 18 },
            { header: "Cycle End Date", key: "cycleEndDate", width: 18 },
            { header: "Settled", key: "isSettled", width: 12 },
        ], formatted);
    }
    static async allInOne(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.allInOneReport(normalizeReportQuery(query, authUser));
        return {
            ...result,
            data: result.data.map(formatAllInOne),
        };
    }
    static async allInOneExport(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.allInOneReport(normalizeReportQuery(query, authUser, false));
        return (0, csv_1.generateCSV)(result.data.map(formatAllInOne), allInOneExportKeys);
    }
    static async allInOneExportExcel(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.allInOneReport(normalizeReportQuery(query, authUser, false));
        return (0, excel_1.generateExcelBuffer)("All In One Report", allInOneExportColumns, result.data.map(formatAllInOne));
    }
}
exports.ReportsService = ReportsService;
//# sourceMappingURL=reports.service.js.map