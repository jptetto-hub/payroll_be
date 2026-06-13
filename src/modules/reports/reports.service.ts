import { ReportsRepository } from "./reports.repository";
import { generateCSV } from "../../utils/export/csv";
import { generateExcelBuffer } from "../../utils/export/excel";
import {
  getPagination,
  type PaginationQuery,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { AppError } from "../../shared/utils/app-error";

const parseFromDate = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;

const parseToDate = (value?: string) =>
  value ? new Date(`${value}T23:59:59.999Z`) : undefined;

const MAX_REPORT_RANGE_DAYS = Number(process.env.REPORT_MAX_RANGE_DAYS || 31);
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeReportQuery = (query: any, authUser: any, paginate = true) => {
  const { employeeWhere } = resolveEmployeeScope({
    authUser,
    employeeId: query.employeeId as string | undefined,
  });

  let pagination;

  try {
    pagination = getPagination(query as PaginationQuery);
  } catch {
    throw new AppError("Invalid pagination parameters", 400);
  }

  const fromDate = parseFromDate(query.from as string | undefined);
  const toDate = parseToDate(query.to as string | undefined);

  if (!fromDate || !toDate) {
    throw new AppError("from and to date are required for report APIs", 400);
  }

  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw new AppError("Invalid from date. Use YYYY-MM-DD", 400);
  }

  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new AppError("Invalid to date. Use YYYY-MM-DD", 400);
  }

  if (fromDate && toDate && fromDate > toDate) {
    throw new AppError("from date cannot be greater than to date", 400);
  }

  const rangeDays = Math.ceil(
    (toDate.getTime() - fromDate.getTime()) / MS_PER_DAY,
  );

  if (rangeDays > MAX_REPORT_RANGE_DAYS) {
    throw new AppError(
      `Report date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`,
      400,
    );
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

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

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
  { header: "Advance Opening Balance", key: "openingAdvanceBalance", width: 26 },
  { header: "Advance Got", key: "advanceReceived", width: 18 },
  { header: "Advance Deducted", key: "advanceDeduction", width: 20 },
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

const getAdvanceBreakdown = (p: any) => (p.advanceBreakdown as any) ?? {};
const getAdvanceDeductionMode = (p: any) =>
  getAdvanceBreakdown(p).advanceDeductionMode ??
  p.employee?.advanceDeductionMode ??
  "AUTO";
const getManualDeductionAmount = (p: any) =>
  Number(
    getAdvanceBreakdown(p).manualDeductionAmount ?? p.advanceDeduction ?? 0,
  );
const getManualPendingBalance = (p: any) => {
  const breakdown = getAdvanceBreakdown(p);
  const outstanding = Number(breakdown.manualOutstandingTotal ?? 0);
  const deduction = Number(p.advanceDeduction ?? 0);

  return Math.max(outstanding - deduction, 0);
};

const formatPayrollForExport = (p: any) => ({
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
  manualDeductionAmount:
    getAdvanceDeductionMode(p) === "MANUAL" ? getManualDeductionAmount(p) : 0,
  manualPendingBalance:
    getAdvanceDeductionMode(p) === "MANUAL" ? getManualPendingBalance(p) : 0,
  carryForwardApplied: Number(p.carryForwardApplied),
  totalDeduction: Number(p.totalDeduction),
  rawFinalSalary: Number(p.rawFinalSalary),
  finalSalary: Number(p.finalSalary),
  carryForwardDeduction: Number(p.carryForwardDeduction),
  payrollStatus: p.status,
});

const formatAllInOne = (p: any) => ({
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
  openingAdvanceBalance: Number(p.openingAdvanceBalance ?? 0),
  advanceReceived: Number(p.advanceReceived ?? 0),
  advanceDeduction: Number(p.advanceDeduction),
  advanceDeductionMode: getAdvanceDeductionMode(p),
  manualDeductionAmount:
    getAdvanceDeductionMode(p) === "MANUAL" ? getManualDeductionAmount(p) : 0,
  manualPendingBalance:
    getAdvanceDeductionMode(p) === "MANUAL" ? getManualPendingBalance(p) : 0,
  carryForwardApplied: Number(p.carryForwardApplied),
  totalDeduction: Number(p.totalDeduction),
  rawFinalSalary: Number(p.rawFinalSalary),
  finalSalary: Number(p.finalSalary),
  carryForwardDeduction: Number(p.carryForwardDeduction),
  payrollStatus: p.status,
});

const formatAdvanceForExport = (a: any) => ({
  "Employee Code": a.employee.employeeCode,
  Name: a.employee.name,
  "Salary Type": a.employee.salaryType,
  "Advance Deduction Mode": a.employee.advanceDeductionMode,
  "Advance Opening Balance": Number(a.openingAdvanceBalance ?? 0),
  "Advance Got": Number(a.amount),
  "Advance Deducted": Number(a.settledAmount ?? 0),
  "Advance Balance After Deduction": Number(a.remainingAmount ?? 0),
  "Balance Carried Onward": Number(a.carryForwardAmount ?? 0),
  "Settlement Status": a.settlementStatus,
  "Locked By Payroll": a.lockedByPayrollId,
  Date: formatDate(a.date),
  "Pay Cycle Type": a.payCycleType,
  "Cycle Start Date": formatDate(a.cycleStartDate),
  "Cycle End Date": formatDate(a.cycleEndDate),
  Settled: a.isSettled ? "Yes" : "No",
});

const advanceExportKeys = [
  "Employee Code",
  "Name",
  "Salary Type",
  "Advance Deduction Mode",
  "Advance Opening Balance",
  "Advance Got",
  "Advance Deducted",
  "Advance Balance After Deduction",
  "Balance Carried Onward",
  "Settlement Status",
  "Locked By Payroll",
  "Date",
  "Pay Cycle Type",
  "Cycle Start Date",
  "Cycle End Date",
  "Settled",
];

const formatAllInOneForExport = (p: any) => {
  const item = formatAllInOne(p);

  return {
    "Employee Code": item.employeeCode,
    Name: item.name,
    "Salary Type": item.salaryType,
    "Period Start": item.periodStart,
    "Period End": item.periodEnd,
    "Standard Salary": item.standardSalary,
    "OT Hours": item.otTotalHours,
    "OT Hourly Rate": item.otHourlyRate,
    "OT Earnings": item.otEarnings,
    "Gross Salary": item.grossSalary,
    "Advance Opening Balance": item.openingAdvanceBalance,
    "Advance Got": item.advanceReceived,
    "Advance Deducted": item.advanceDeduction,
    "Advance Deduction Mode": item.advanceDeductionMode,
    "Manual Deduction Amount": item.manualDeductionAmount,
    "Manual Pending Balance": item.manualPendingBalance,
    "Carry Forward Applied": item.carryForwardApplied,
    "Total Deduction": item.totalDeduction,
    "Raw Final Salary": item.rawFinalSalary,
    "Final Salary": item.finalSalary,
    "Carry Forward Deduction": item.carryForwardDeduction,
    "Payroll Status": item.payrollStatus,
  };
};

const allInOneHumanExportKeys = [
  "Employee Code",
  "Name",
  "Salary Type",
  "Period Start",
  "Period End",
  "Standard Salary",
  "OT Hours",
  "OT Hourly Rate",
  "OT Earnings",
  "Gross Salary",
  "Advance Opening Balance",
  "Advance Got",
  "Advance Deducted",
  "Advance Deduction Mode",
  "Manual Deduction Amount",
  "Manual Pending Balance",
  "Carry Forward Applied",
  "Total Deduction",
  "Raw Final Salary",
  "Final Salary",
  "Carry Forward Deduction",
  "Payroll Status",
];

export class ReportsService {
  static async salary(query: any, authUser: any) {
    return ReportsRepository.salaryReport(
      normalizeReportQuery(query, authUser),
    );
  }

  static async salaryExport(query: any, authUser: any) {
    const result = await ReportsRepository.salaryReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateCSV(
      (result.data as any[]).map(formatPayrollForExport),
      salaryExportKeys,
    );
  }

  static async attendance(query: any, authUser: any) {
    return ReportsRepository.attendanceReport(
      normalizeReportQuery(query, authUser),
    );
  }

  static async attendanceExport(query: any, authUser: any) {
    const result = await ReportsRepository.attendanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    const formatted = (result.data as any[]).map((a) => ({
      employeeCode: a.employee.employeeCode,
      name: a.employee.name,
      salaryType: a.employee.salaryType,
      date: formatDate(a.date),
      status: a.status,
      otHours: Number(a.otHours ?? 0),
    }));

    return generateCSV(formatted, [
      "employeeCode",
      "name",
      "salaryType",
      "date",
      "status",
      "otHours",
    ]);
  }

  static async advance(query: any, authUser: any) {
    return ReportsRepository.advanceReport(
      normalizeReportQuery(query, authUser),
    );
  }

  static async advanceExport(query: any, authUser: any) {
    const result = await ReportsRepository.advanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateCSV(
      (result.data as any[]).map(formatAdvanceForExport),
      advanceExportKeys,
    );
  }

  static async salaryExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.salaryReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateExcelBuffer(
      "Salary Report",
      salaryExportColumns,
      (result.data as any[]).map(formatPayrollForExport),
    );
  }

  static async attendanceExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.attendanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    const formatted = (result.data as any[]).map((a) => ({
      employeeCode: a.employee.employeeCode,
      name: a.employee.name,
      salaryType: a.employee.salaryType,
      date: formatDate(a.date),
      status: a.status,
      otHours: Number(a.otHours ?? 0),
    }));

    return generateExcelBuffer(
      "Attendance Report",
      [
        { header: "Employee Code", key: "employeeCode", width: 18 },
        { header: "Name", key: "name", width: 25 },
        { header: "Salary Type", key: "salaryType", width: 15 },
        { header: "Date", key: "date", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "OT Hours", key: "otHours", width: 12 },
      ],
      formatted,
    );
  }

  static async advanceExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.advanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateExcelBuffer(
      "Advance Report",
      [
        { header: "Employee Code", key: "employeeCode", width: 18 },
        { header: "Name", key: "name", width: 25 },
        { header: "Salary Type", key: "salaryType", width: 15 },
        { header: "Advance Deduction Mode", key: "advanceDeductionMode", width: 26 },
        { header: "Advance Opening Balance", key: "openingAdvanceBalance", width: 26 },
        { header: "Advance Got", key: "amount", width: 15 },
        { header: "Advance Deducted", key: "settledAmount", width: 18 },
        { header: "Advance Balance After Deduction", key: "remainingAmount", width: 30 },
        { header: "Balance Carried Onward", key: "carryForwardAmount", width: 24 },
        { header: "Settlement Status", key: "settlementStatus", width: 22 },
        { header: "Locked By Payroll", key: "lockedByPayrollId", width: 38 },
        { header: "Date", key: "date", width: 15 },
        { header: "Pay Cycle Type", key: "payCycleType", width: 18 },
        { header: "Cycle Start Date", key: "cycleStartDate", width: 18 },
        { header: "Cycle End Date", key: "cycleEndDate", width: 18 },
        { header: "Settled", key: "isSettled", width: 12 },
      ],
      (result.data as any[]).map((a) => ({
        employeeCode: a.employee.employeeCode,
        name: a.employee.name,
        salaryType: a.employee.salaryType,
        advanceDeductionMode: a.employee.advanceDeductionMode,
        openingAdvanceBalance: Number(a.openingAdvanceBalance ?? 0),
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
      })),
    );
  }

  static async allInOne(query: any, authUser: any) {
    const result = await ReportsRepository.allInOneReport(
      normalizeReportQuery(query, authUser),
    );

    return {
      ...result,
      data: (result.data as any[]).map(formatAllInOne),
    };
  }

  static async allInOneExport(query: any, authUser: any) {
    const result = await ReportsRepository.allInOneReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateCSV(
      (result.data as any[]).map(formatAllInOneForExport),
      allInOneHumanExportKeys,
    );
  }

  static async allInOneExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.allInOneReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateExcelBuffer(
      "All In One Report",
      allInOneExportColumns,
      (result.data as any[]).map(formatAllInOne),
    );
  }
}
