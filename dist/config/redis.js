"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = require("./logger");
exports.redis = env_1.env.redisUrl
    ? new ioredis_1.default(env_1.env.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    })
    : new ioredis_1.default({
        host: env_1.env.redisHost,
        port: env_1.env.redisPort,
        password: env_1.env.redisPassword,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
exports.redis.on("error", (error) => {
    logger_1.logger.error({ error }, "Redis connection error");
});
//# sourceMappingURL=redis.js.map