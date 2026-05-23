const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export function buildActivePayrollKey(params: {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return `${params.employeeId}_${formatDate(params.periodStart)}_${formatDate(params.periodEnd)}`;
}
