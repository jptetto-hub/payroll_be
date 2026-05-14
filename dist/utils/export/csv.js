"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCSV = void 0;
const generateCSV = (data, headers) => {
    const rows = data.map((item) => headers.map((key) => `"${item[key] ?? ""}"`).join(","));
    return [headers.join(","), ...rows].join("\n");
};
exports.generateCSV = generateCSV;
//# sourceMappingURL=csv.js.map