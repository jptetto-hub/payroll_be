import ExcelJS from "exceljs";

export const generateExcelBuffer = async (
  sheetName: string,
  columns: {
    header: string;
    key: string;
    width?: number;
  }[],
  data: Record<string, any>[],
) => {
  const workbook = new ExcelJS.Workbook();

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
