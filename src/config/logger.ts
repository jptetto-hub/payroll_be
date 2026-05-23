import pino from "pino";

const loggerOptions: pino.LoggerOptions =
  process.env.NODE_ENV !== "production"
    ? {
        level: process.env.LOG_LEVEL || "info",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }
    : {
        level: process.env.LOG_LEVEL || "info",
      };

export const logger = pino(loggerOptions);
