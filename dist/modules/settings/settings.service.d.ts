export declare class SettingsService {
    static getSettings(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        weekStartsOn: import(".prisma/client").$Enums.WeekStartsOn;
        monthlyPayrollDay: number | null;
        autoPayrollEnabled: boolean;
    }>;
    static updateSettings(data: {
        weekStartsOn?: "MONDAY" | "SUNDAY";
        monthlyPayrollDay?: number | null;
        autoPayrollEnabled?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        weekStartsOn: import(".prisma/client").$Enums.WeekStartsOn;
        monthlyPayrollDay: number | null;
        autoPayrollEnabled: boolean;
    }>;
    static listWorkHourSettings(query: any): Promise<{
        data: any;
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static createWorkHourSetting(data: {
        workStartTime: string;
        workEndTime: string;
        effectiveFromDate: string;
        note?: string | null;
    }, createdById?: string): Promise<any>;
    static updateWorkHourSetting(id: string, data: {
        workStartTime?: string;
        workEndTime?: string;
        effectiveFromDate?: string;
        isActive?: boolean;
        note?: string | null;
    }): Promise<any>;
    static deleteWorkHourSetting(id: string): Promise<any>;
}
//# sourceMappingURL=settings.service.d.ts.map