"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const prisma_1 = require("../../config/prisma");
const DEFAULT_SETTINGS_ID = "default-settings";
class SettingsRepository {
    static get() {
        return prisma_1.prisma.systemSetting.upsert({
            where: { id: DEFAULT_SETTINGS_ID },
            update: {},
            create: {
                id: DEFAULT_SETTINGS_ID,
                weekStartsOn: "MONDAY",
                autoPayrollEnabled: true,
            },
        });
    }
    static update(data) {
        return prisma_1.prisma.systemSetting.upsert({
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
exports.SettingsRepository = SettingsRepository;
//# sourceMappingURL=settings.repository.js.map