"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeBigInt = serializeBigInt;
function serializeBigInt(data) {
    return JSON.parse(JSON.stringify(data, (_key, value) => typeof value === "bigint" ? Number(value) : value));
}
//# sourceMappingURL=serializeBigInt.js.map