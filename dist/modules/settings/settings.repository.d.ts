export declare class SettingsRepository {
    static get(): import(".prisma/client").Prisma.Prisma__SystemSettingClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        weekStartsOn: import(".prisma/client").$Enums.WeekStartsOn;
        monthlyPayrollDay: number | null;
        autoPayrollEnabled: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static update(data: {
        weekStartsOn?: "MONDAY" | "SUNDAY";
        monthlyPayrollDay?: number | null;
        autoPayrollEnabled?: boolean;
    }): import(".prisma/client").Prisma.Prisma__SystemSettingClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        weekStartsOn: import(".prisma/client").$Enums.WeekStartsOn;
        monthlyPayrollDay: number | null;
        autoPayrollEnabled: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
}
//# sourceMappingURL=settings.repository.d.ts.map