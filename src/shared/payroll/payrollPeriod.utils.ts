import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export const getEffectivePayrollPeriod = ({
  periodStart,
  periodEnd,
  joiningDate,
}: {
  periodStart: Date;
  periodEnd: Date;
  joiningDate: Date;
}) => {
  const start = dayjs.utc(periodStart).startOf("day");
  const end = dayjs.utc(periodEnd).endOf("day");
  const joined = dayjs.utc(joiningDate).startOf("day");

  const effectiveStart = joined.isAfter(start, "day") ? joined : start;

  return {
    effectivePeriodStart: effectiveStart.toDate(),
    effectivePeriodEnd: end.toDate(),
    joinedDuringCycle:
      joined.isAfter(start, "day") && !joined.isAfter(end, "day"),
  };
};
