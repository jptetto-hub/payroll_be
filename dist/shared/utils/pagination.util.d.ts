export type PaginationQuery = {
    page?: string | number;
    limit?: string | number;
};
export type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};
export declare const getPagination: (query: PaginationQuery) => {
    page: number;
    limit: number;
    skip: number;
    take: number;
};
export declare const buildPaginationMeta: (total: number, page: number, limit: number) => PaginationMeta;
//# sourceMappingURL=pagination.util.d.ts.map