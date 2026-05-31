import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { initSentry } from "./config/sentry";
import { SettingsService } from "./modules/settings/settings.service";
import { startOrganizationTimezoneSubscriber } from "./config/timezone-sync";

initSentry();

const startServer = async () => {
  try {
    const timezone = await SettingsService.initializeOrganizationTimezone();
    logger.info({ timezone }, "Organization timezone loaded");
    await startOrganizationTimezoneSubscriber();
  } catch (error) {
    logger.warn({ error }, "Using APP_TIMEZONE fallback because organization timezone could not be loaded");
  }

  app.listen(env.port, () => {
    logger.info({ port: env.port }, "Server started");
  });
};

void startServer();
