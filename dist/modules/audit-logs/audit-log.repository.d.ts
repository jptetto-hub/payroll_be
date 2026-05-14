import { AuditAction } from "@prisma/client";
export declare class AuditLogRepository {
    static create(data: {
        userId?: string;
        action: AuditAction;
        module: string;
        oldData?: any;
        newData?: any;
        ipAddress?: string;
    }): import(".prisma/client").Prisma.Prisma__AuditLogClient<{
        id: string;
        createdAt: Date;
        action: import(".prisma/client").$Enums.AuditAction;
        module: string;
        oldData: import("@prisma/client/runtime/client").JsonValue | null;
        newData: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static list(params: {
        skip: number;
        take: number;
        userId?: string;
        module?: string;
        action?: AuditAction;
    }): Promise<[({
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
    })[], number]>;
    static findById(id: string): import(".prisma/client").Prisma.Prisma__AuditLogClient<({
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
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static listByUser(userId: string, pagination?: {
        skip: number;
        take: number;
    }): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        action: import(".prisma/client").$Enums.AuditAction;
        module: string;
        oldData: import("@prisma/client/runtime/client").JsonValue | null;
        newData: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userId: string | null;
    }[]>;
    static countByUser(userId: string): import(".prisma/client").Prisma.PrismaPromise<number>;
}
//# sourceMappingURL=audit-log.repository.d.ts.map