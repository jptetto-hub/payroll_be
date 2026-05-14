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
}
//# sourceMappingURL=settings.service.d.ts.map