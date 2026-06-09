"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheForSeconds = cacheForSeconds;
exports.noStore = noStore;
function cacheForSeconds(seconds) {
    return (_req, res, next) => {
        res.setHeader("Cache-Control", `private, max-age=${seconds}, stale-while-revalidate=${seconds}`);
        next();
    };
}
function noStore() {
    return (_req, res, next) => {
        res.setHeader("Cache-Control", "no-store");
        next();
    };
}
//# sourceMappingURL=cacheHeaders.middleware.js.map