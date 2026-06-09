import { Queue, type ConnectionOptions } from "bullmq";
import { redis } from "../config/redis";

export const redisConnection = redis as unknown as ConnectionOptions;

export const payrollSchedulerQueue = new Queue("payroll-scheduler", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});
