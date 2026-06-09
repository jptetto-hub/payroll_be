"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOrganizationTimezoneSubscriber = exports.publishOrganizationTimezone = void 0;
const logger_1 = require("./logger");
const redis_1 = require("./redis");
const timezone_1 = require("./timezone");
const ORGANIZATION_TIMEZONE_CHANNEL = "settings:organization-timezone";
const publishOrganizationTimezone = async (timezone) => {
    await redis_1.redis.publish(ORGANIZATION_TIMEZONE_CHANNEL, timezone);
};
exports.publishOrganizationTimezone = publishOrganizationTimezone;
const startOrganizationTimezoneSubscriber = async () => {
    const subscriber = redis_1.redis.duplicate();
    subscriber.on("error", (error) => {
        logger_1.logger.error({ error }, "Organization timezone Redis subscriber failed");
    });
    await subscriber.subscribe(ORGANIZATION_TIMEZONE_CHANNEL);
    subscriber.on("message", (_channel, timezone) => {
        try {
            const appliedTimezone = (0, timezone_1.setOrganizationTimezone)(timezone);
            logger_1.logger.info({ timezone: appliedTimezone }, "Organization timezone updated from Redis");
        }
        catch (error) {
            logger_1.logger.error({ error, timezone }, "Ignored invalid organization timezone from Redis");
        }
    });
    return subscriber;
};
exports.startOrganizationTimezoneSubscriber = startOrganizationTimezoneSubscriber;
//# sourceMappingURL=timezone-sync.js.map