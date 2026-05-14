import { SettingsRepository } from "./settings.repository";

export class SettingsService {
  static async getSettings() {
    return SettingsRepository.get();
  }

  static async updateSettings(data: {
    weekStartsOn?: "MONDAY" | "SUNDAY";
    monthlyPayrollDay?: number | null;
    autoPayrollEnabled?: boolean;
  }) {
    if (Object.keys(data).length === 0) {
      throw new Error("At least one setting field is required");
    }

    return SettingsRepository.update(data);
  }
}
