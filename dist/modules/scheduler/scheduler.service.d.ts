export declare class SchedulerService {
    static runPayrollScheduler(triggeredBy?: "CRON" | "MANUAL"): Promise<{
        triggeredBy: "MANUAL" | "CRON";
        totalEmployees: number;
        successCount: number;
        skippedCount: number;
        failureCount: number;
        generated: any[];
        skipped: any[];
        failed: any[];
    }>;
    static listRuns(query: any): Promise<{
        data: {
            id: string;
            name: string;
            createdAt: Date;
            success: boolean;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
            startedAt: Date;
            finishedAt: Date | null;
            errorMessage: string | null;
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
}
//# sourceMappingURL=scheduler.service.d.ts.map