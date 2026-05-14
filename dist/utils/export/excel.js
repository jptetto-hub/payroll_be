"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExcelBuffer = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const generateExcelBuffer = async (sheetName, columns, data) => {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = "Payroll Attendance App";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.width || 20,
    }));
    worksheet.getRow(1).font = {
        bold: true,
    };
    worksheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
    };
    worksheet.addRows(data);
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};
exports.generateExcelBuffer = generateExcelBuffer;
//# sourceMappingURL=excel.js.map