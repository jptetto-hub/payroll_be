import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export const getWorkingDatesBetween = (from: Date, to: Date) => {
  const dates: string[] = [];

  let cursor = dayjs.utc(from).startOf("day");
  const end = dayjs.utc(to).startOf("day");

  while (cursor.isSame(end, "day") || cursor.isBefore(end, "day")) {
    if (cursor.day() !== 0) {
      dates.push(cursor.format("YYYY-MM-DD"));
    }

    cursor = cursor.add(1, "day");
  }

  return dates;
};
