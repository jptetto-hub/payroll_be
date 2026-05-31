import { getOrganizationTimezone } from "../../config/timezone";

export const getBusinessDate = (
  instant = new Date(),
  timezone = getOrganizationTimezone(),
) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(Date.UTC(read("year"), read("month") - 1, read("day")));
};
