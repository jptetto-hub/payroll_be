export const getValidTimezone = (value: string | undefined, fallback: string) => {
  const timezone = value || fallback;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    throw new Error(`Invalid IANA timezone: ${timezone}`);
  }
};

export const APP_TIMEZONE = getValidTimezone(process.env.APP_TIMEZONE, "UTC");

let organizationTimezone = APP_TIMEZONE;

export const getOrganizationTimezone = () => organizationTimezone;

export const setOrganizationTimezone = (timezone: string | undefined) => {
  organizationTimezone = getValidTimezone(timezone, APP_TIMEZONE);
  return organizationTimezone;
};

export const getConfiguredTimezone = (value: string | undefined) =>
  getValidTimezone(value, getOrganizationTimezone());
