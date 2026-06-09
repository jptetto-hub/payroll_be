export const configurablePermissionKeys = [
  "DASHBOARD",
  "EMPLOYEES",
  "ATTENDANCE",
  "SALARY_HISTORY",
  "SALARY_CALCULATION",
  "ADVANCES",
  "PAYROLL",
  "PAYSLIPS",
  "LEDGER",
  "REPORTS",
  "AUDIT_LOGS",
  "SETTINGS",
] as const;

export type ConfigurablePermissionKey =
  (typeof configurablePermissionKeys)[number];
export type ConfigurableRole = "ADMIN" | "USER";
export type RolePermissions = Record<
  ConfigurableRole,
  Record<ConfigurablePermissionKey, boolean>
>;

export const defaultRolePermissions: RolePermissions = {
  ADMIN: {
    DASHBOARD: true,
    EMPLOYEES: true,
    ATTENDANCE: true,
    SALARY_HISTORY: true,
    SALARY_CALCULATION: true,
    ADVANCES: true,
    PAYROLL: true,
    PAYSLIPS: true,
    LEDGER: true,
    REPORTS: true,
    AUDIT_LOGS: true,
    SETTINGS: true,
  },
  USER: {
    DASHBOARD: true,
    EMPLOYEES: false,
    ATTENDANCE: true,
    SALARY_HISTORY: true,
    SALARY_CALCULATION: false,
    ADVANCES: true,
    PAYROLL: false,
    PAYSLIPS: true,
    LEDGER: true,
    REPORTS: false,
    AUDIT_LOGS: false,
    SETTINGS: false,
  },
};

const allowedRolePermissions: RolePermissions = {
  ADMIN: Object.fromEntries(
    configurablePermissionKeys.map((key) => [key, true]),
  ) as Record<ConfigurablePermissionKey, boolean>,
  USER: {
    ...defaultRolePermissions.USER,
  },
};

export function normalizeRolePermissions(value: unknown): RolePermissions {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, Record<string, unknown>>)
      : {};

  return {
    ADMIN: normalizeRolePermission(
      input.ADMIN,
      defaultRolePermissions.ADMIN,
      allowedRolePermissions.ADMIN,
    ),
    USER: normalizeRolePermission(
      input.USER,
      defaultRolePermissions.USER,
      allowedRolePermissions.USER,
    ),
  };
}

function normalizeRolePermission(
  value: Record<string, unknown> | undefined,
  defaults: Record<ConfigurablePermissionKey, boolean>,
  allowed: Record<ConfigurablePermissionKey, boolean>,
) {
  return Object.fromEntries(
    configurablePermissionKeys.map((key) => [
      key,
      allowed[key] && typeof value?.[key] === "boolean"
        ? value[key]
        : defaults[key],
    ]),
  ) as Record<ConfigurablePermissionKey, boolean>;
}
