export declare class AppError extends Error {
    readonly statusCode: number;
    readonly errors: unknown[];
    constructor(message: string, statusCode?: number, errors?: unknown[]);
}
//# sourceMappingURL=app-error.d.ts.map