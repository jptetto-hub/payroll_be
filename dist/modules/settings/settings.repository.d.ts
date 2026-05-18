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
    static listWorkHourSettings(params: {
        skip: number;
        take: number;
    }): Promise<[any, any]>;
    static findWorkHourSetting(id: string): any;
    static findWorkHourSettingByEffectiveDate(effectiveFromDate: Date): any;
    static createWorkHourSetting(data: {
        workStartTime: string;
        workEndTime: string;
        standardMinutes: number;
        effectiveFromDate: Date;
        note?: string | null;
        createdById?: string | null;
    }): any;
    static updateWorkHourSetting(id: string, data: {
        workStartTime?: string;
        workEndTime?: string;
        standardMinutes?: number;
        effectiveFromDate?: Date;
        isActive?: boolean;
        note?: string | null;
    }): any;
    static deleteWorkHourSetting(id: string): any;
}
//# sourceMappingURL=settings.repository.d.ts.map