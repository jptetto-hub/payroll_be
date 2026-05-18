"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const prisma_1 = require("../../config/prisma");
const DEFAULT_SETTINGS_ID = "default-settings";
const db = prisma_1.prisma;
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
    static listWorkHourSettings(params) {
        return prisma_1.prisma.$transaction([
            db.workHourSetting.findMany({
                skip: params.skip,
                take: params.take,
                orderBy: { effectiveFromDate: "desc" },
            }),
            db.workHourSetting.count(),
        ]);
    }
    static findWorkHourSetting(id) {
        return db.workHourSetting.findUnique({ where: { id } });
    }
    static findWorkHourSettingByEffectiveDate(effectiveFromDate) {
        return db.workHourSetting.findUnique({
            where: { effectiveFromDate },
        });
    }
    static createWorkHourSetting(data) {
        return db.workHourSetting.create({
            data: {
                ...data,
                isActive: true,
            },
        });
    }
    static updateWorkHourSetting(id, data) {
        return db.workHourSetting.update({
            where: { id },
            data,
        });
    }
    static deleteWorkHourSetting(id) {
        return db.workHourSetting.update({
            where: { id },
            data: { isActive: false },
        });
    }
}
exports.SettingsRepository = SettingsRepository;
//# sourceMappingURL=settings.repository.js.map