"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const replaceRequestValue = (req, key, value) => {
    Object.defineProperty(req, key, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
    });
};
const validate = (schema) => (req, _res, next) => {
    const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
    });
    if (!result.success) {
        return next(result.error);
    }
    const parsed = result.data;
    if (parsed.body !== undefined) {
        req.body = parsed.body;
    }
    if (parsed.query !== undefined) {
        replaceRequestValue(req, "query", parsed.query);
    }
    if (parsed.params !== undefined) {
        replaceRequestValue(req, "params", parsed.params);
    }
    next();
};
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map