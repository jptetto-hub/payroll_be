import { logger } from "./logger";
import { redis } from "./redis";
import { setOrganizationTimezone } from "./timezone";

const ORGANIZATION_TIMEZONE_CHANNEL = "settings:organization-timezone";

export const publishOrganizationTimezone = async (timezone: string) => {
  await redis.publish(ORGANIZATION_TIMEZONE_CHANNEL, timezone);
};

export const startOrganizationTimezoneSubscriber = async () => {
  const subscriber = redis.duplicate();

  subscriber.on("error", (error) => {
    logger.error({ error }, "Organization timezone Redis subscriber failed");
  });

  await subscriber.subscribe(ORGANIZATION_TIMEZONE_CHANNEL);
  subscriber.on("message", (_channel, timezone) => {
    try {
      const appliedTimezone = setOrganizationTimezone(timezone);
      logger.info({ timezone: appliedTimezone }, "Organization timezone updated from Redis");
    } catch (error) {
      logger.error({ error, timezone }, "Ignored invalid organization timezone from Redis");
    }
  });

  return subscriber;
};
