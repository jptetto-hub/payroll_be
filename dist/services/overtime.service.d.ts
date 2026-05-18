export declare const parseDateOnly: (value: string) => Date;
export declare const formatDateOnly: (date: Date) => string;
export declare const normalizeTime: (value: string) => string;
export declare const getStandardMinutes: (workStartTime: string, workEndTime: string) => number;
export declare class OvertimeService {
    static getSettingForDate(date: Date): Promise<any>;
    static calculateForAttendance(params: {
        attendanceDate: Date;
        checkInTime?: Date | null;
        checkOutTime?: Date | null;
        otStartTime?: Date | null;
        otEndTime?: Date | null;
        otManualOverride?: boolean;
        otHours?: number | null;
        otOverrideReason?: string | null;
    }): Promise<{
        otHours: number;
        otStartTime: Date | null;
        otEndTime: Date | null;
        otManualOverride: boolean;
        otOverrideReason: string | null;
        otBreakdown: {
            mode: string;
            workHourSettingId: any;
            workStartTime: any;
            workEndTime: any;
            standardMinutes: any;
            standardStart: string;
            standardEnd: string;
        };
    }>;
}
//# sourceMappingURL=overtime.service.d.ts.map