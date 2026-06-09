"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payrollSchedulerQueue = exports.redisConnection = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.redisConnection = redis_1.redis;
exports.payrollSchedulerQueue = new bullmq_1.Queue("payroll-scheduler", {
    connection: exports.redisConnection,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
    },
});
//# sourceMappingURL=payrollScheduler.queue.js.map