"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const settings_repository_1 = require("./settings.repository");
class SettingsService {
    static async getSettings() {
        return settings_repository_1.SettingsRepository.get();
    }
    static async updateSettings(data) {
        if (Object.keys(data).length === 0) {
            throw new Error("At least one setting field is required");
        }
        return settings_repository_1.SettingsRepository.update(data);
    }
}
exports.SettingsService = SettingsService;
//# sourceMappingURL=settings.service.js.map