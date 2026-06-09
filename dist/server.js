"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const sentry_1 = require("./config/sentry");
const settings_service_1 = require("./modules/settings/settings.service");
const timezone_sync_1 = require("./config/timezone-sync");
(0, sentry_1.initSentry)();
const startServer = async () => {
    try {
        const timezone = await settings_service_1.SettingsService.initializeOrganizationTimezone();
        logger_1.logger.info({ timezone }, "Organization timezone loaded");
        await (0, timezone_sync_1.startOrganizationTimezoneSubscriber)();
    }
    catch (error) {
        logger_1.logger.warn({ error }, "Using APP_TIMEZONE fallback because organization timezone could not be loaded");
    }
    app_1.default.listen(env_1.env.port, () => {
        logger_1.logger.info({ port: env_1.env.port }, "Server started");
    });
};
void startServer();
//# sourceMappingURL=server.js.map