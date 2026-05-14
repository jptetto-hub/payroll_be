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
    if (fromDate && Number.isNaN(fromDate.getTime())) {
        throw new app_error_1.AppError("Invalid from date. Use YYYY-MM-DD", 400);
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
        throw new app_error_1.AppError("Invalid to date. Use YYYY-MM-DD", 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
        throw new app_error_1.AppError("from date cannot be greater than to date", 400);
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
const salaryExportKeys = [
    "employeeCode",
    "name",
    "salaryType",
    "periodStart",
    "periodEnd",
    "grossSalary",
    "advanceDeduction",
    "carryForwardApplied",
    "totalDeduction",
    "rawFinalSalary",
    "finalSalary",
    "carryForwardDeduction",
    "payrollStatus",
];
const formatPayrollForExport = (p) => ({
    employeeCode: p.employee.employeeCode,
    name: p.employee.name,
    salaryType: p.employee.salaryType,
    periodStart: formatDate(p.periodStart),
    periodEnd: formatDate(p.periodEnd),
    grossSalary: Number(p.grossSalary),
    advanceDeduction: Number(p.advanceDeduction),
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
    grossSalary: Number(p.grossSalary),
    advanceDeduction: Number(p.advanceDeduction),
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
        }));
        return (0, csv_1.generateCSV)(formatted, [
            "employeeCode",
            "name",
            "salaryType",
            "date",
            "status",
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
        }));
        return (0, excel_1.generateExcelBuffer)("Attendance Report", [
            { header: "Employee Code", key: "employeeCode", width: 18 },
            { header: "Name", key: "name", width: 25 },
            { header: "Salary Type", key: "salaryType", width: 15 },
            { header: "Date", key: "date", width: 15 },
            { header: "Status", key: "status", width: 15 },
        ], formatted);
    }
    static async advanceExportExcel(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.advanceReport(normalizeReportQuery(query, authUser, false));
        const formatted = result.data.map((a) => ({
            employeeCode: a.employee.employeeCode,
            name: a.employee.name,
            salaryType: a.employee.salaryType,
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
        return (0, csv_1.generateCSV)(result.data.map(formatAllInOne), [
            "employeeCode",
            "name",
            "salaryType",
            "periodStart",
            "periodEnd",
            "grossSalary",
            "advanceDeduction",
            "carryForwardApplied",
            "totalDeduction",
            "rawFinalSalary",
            "finalSalary",
            "carryForwardDeduction",
            "payrollStatus",
        ]);
    }
    static async allInOneExportExcel(query, authUser) {
        const result = await reports_repository_1.ReportsRepository.allInOneReport(normalizeReportQuery(query, authUser, false));
        return (0, excel_1.generateExcelBuffer)("All In One Report", salaryExportColumns, result.data.map(formatAllInOne));
    }
}
exports.ReportsService = ReportsService;
//# sourceMappingURL=reports.service.js.map