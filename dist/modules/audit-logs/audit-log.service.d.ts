import { AuditAction } from "@prisma/client";
export declare class AuditLogService {
    static create(data: {
        userId?: string | undefined;
        action: AuditAction;
        module: string;
        oldData?: any;
        newData?: any;
        ipAddress?: string | undefined;
    }): Promise<{
        id: string;
        createdAt: Date;
        action: import(".prisma/client").$Enums.AuditAction;
        module: string;
        oldData: import("@prisma/client/runtime/client").JsonValue | null;
        newData: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userId: string | null;
    }>;
    static log(data: {
        userId?: string | undefined;
        action: AuditAction;
        module: string;
        oldData?: any;
        newData?: any;
        ipAddress?: string | undefined;
    }): Promise<{
        id: string;
        createdAt: Date;
        action: import(".prisma/client").$Enums.AuditAction;
        module: string;
        oldData: import("@prisma/client/runtime/client").JsonValue | null;
        newData: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userId: string | null;
    }>;
    static list(query: any): Promise<{
        data: ({
            user: {
                id: string;
                employeeCode: string;
                phone: string;
                name: string;
                role: import(".prisma/client").$Enums.Role;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            action: import(".prisma/client").$Enums.AuditAction;
            module: string;
            oldData: import("@prisma/client/runtime/client").JsonValue | null;
            newData: import("@prisma/client/runtime/client").JsonValue | null;
            ipAddress: string | null;
            userId: string | null;
        })[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static getById(id: string): Promise<{
        user: {
            id: string;
            employeeCode: string;
            phone: string;
            name: string;
            role: import(".prisma/client").$Enums.Role;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        action: import(".prisma/client").$Enums.AuditAction;
        module: string;
        oldData: import("@prisma/client/runtime/client").JsonValue | null;
        newData: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userId: string | null;
    }>;
    static listByUser(userId: string, query: any): Promise<{
        data: {
            id: string;
            createdAt: Date;
            action: import(".prisma/client").$Enums.AuditAction;
            module: string;
            oldData: import("@prisma/client/runtime/client").JsonValue | null;
            newData: import("@prisma/client/runtime/client").JsonValue | null;
            ipAddress: string | null;
            userId: string | null;
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
}
//# sourceMappingURL=audit-log.service.d.ts.map