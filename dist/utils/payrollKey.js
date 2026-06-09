"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildActivePayrollKey = buildActivePayrollKey;
const formatDate = (date) => date.toISOString().slice(0, 10);
function buildActivePayrollKey(params) {
    return `${params.employeeId}_${formatDate(params.periodStart)}_${formatDate(params.periodEnd)}`;
}
//# sourceMappingURL=payrollKey.js.map