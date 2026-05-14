import { prisma } from "../../config/prisma";

const DEFAULT_SETTINGS_ID = "default-settings";

export class SettingsRepository {
  static get() {
    return prisma.systemSetting.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      update: {},
      create: {
        id: DEFAULT_SETTINGS_ID,
        weekStartsOn: "MONDAY",
        autoPayrollEnabled: true,
      },
    });
  }

  static update(data: {
    weekStartsOn?: "MONDAY" | "SUNDAY";
    monthlyPayrollDay?: number | null;
    autoPayrollEnabled?: boolean;
  }) {
    return prisma.systemSetting.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      update: data,
      create: {
        id: DEFAULT_SETTINGS_ID,
        weekStartsOn: data.weekStartsOn ?? "MONDAY",
        monthlyPayrollDay: data.monthlyPayrollDay ?? null,
        autoPayrollEnabled: data.autoPayrollEnabled ?? true,
      },
    });
  }
}
