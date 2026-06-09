import { prisma, readPrisma } from "../../config/prisma";
import { RolePermissions } from "./role-permissions";

const DEFAULT_SETTINGS_ID = "default-settings";
const db = prisma as any;

export class SettingsRepository {
  static get() {
    return prisma.systemSetting.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      update: {},
      create: {
        id: DEFAULT_SETTINGS_ID,
        weekStartsOn: "MONDAY",
        autoPayrollEnabled: true,
        organizationTimezone: "UTC",
        rolePermissions: {},
      },
    });
  }

  static update(data: {
    weekStartsOn?: "MONDAY" | "SUNDAY";
    monthlyPayrollDay?: number | null;
    autoPayrollEnabled?: boolean;
    organizationTimezone?: string;
    rolePermissions?: RolePermissions;
  }) {
    return prisma.systemSetting.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      update: data,
      create: {
        id: DEFAULT_SETTINGS_ID,
        weekStartsOn: data.weekStartsOn ?? "MONDAY",
        monthlyPayrollDay: data.monthlyPayrollDay ?? null,
        autoPayrollEnabled: data.autoPayrollEnabled ?? true,
        organizationTimezone: data.organizationTimezone ?? "UTC",
        rolePermissions: data.rolePermissions ?? {},
      },
    });
  }

  static listWorkHourSettings(params: { skip: number; take: number }) {
    return Promise.all([
      (readPrisma as any).workHourSetting.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: { effectiveFromDate: "desc" },
      }),
      (readPrisma as any).workHourSetting.count(),
    ]);
  }

  static findWorkHourSetting(id: string) {
    return db.workHourSetting.findUnique({ where: { id } });
  }

  static findWorkHourSettingByEffectiveDate(effectiveFromDate: Date) {
    return db.workHourSetting.findUnique({
      where: { effectiveFromDate },
    });
  }

  static createWorkHourSetting(data: {
    workStartTime: string;
    workEndTime: string;
    standardMinutes: number;
    effectiveFromDate: Date;
    note?: string | null;
    createdById?: string | null;
  }) {
    return db.workHourSetting.create({
      data: {
        ...data,
        isActive: true,
      },
    });
  }

  static updateWorkHourSetting(
    id: string,
    data: {
      workStartTime?: string;
      workEndTime?: string;
      standardMinutes?: number;
      effectiveFromDate?: Date;
      isActive?: boolean;
      note?: string | null;
    },
  ) {
    return db.workHourSetting.update({
      where: { id },
      data,
    });
  }

  static deleteWorkHourSetting(id: string) {
    return db.workHourSetting.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
