"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTimeout = withTimeout;
async function withTimeout(promise, timeoutMs, message = "Operation timed out") {
    let timeoutRef;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutRef = setTimeout(() => {
            reject(new Error(message));
        }, timeoutMs);
    });
    return Promise.race([
        promise.finally(() => {
            if (timeoutRef) {
                clearTimeout(timeoutRef);
            }
        }),
        timeoutPromise,
    ]);
}
//# sourceMappingURL=timeout.js.map