import ExcelJS from "exceljs";
export declare const generateExcelBuffer: (sheetName: string, columns: {
    header: string;
    key: string;
    width?: number;
}[], data: Record<string, any>[]) => Promise<ExcelJS.Buffer>;
//# sourceMappingURL=excel.d.ts.map