import { Queue } from "bullmq";
import { redis } from "../config/redis";

export const redisConnection = redis;

export const payrollSchedulerQueue = new Queue("payroll-scheduler", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});
