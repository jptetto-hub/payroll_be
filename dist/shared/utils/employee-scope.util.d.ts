import { Role } from "@prisma/client";
type EmployeeScopeParams = {
    authUser: {
        id: string;
        role: Role;
    };
    employeeId?: string | undefined;
};
export declare const resolveEmployeeScope: ({ authUser, employeeId, }: EmployeeScopeParams) => {
    employeeWhere: {
        id: string;
        role?: never;
    };
} | {
    employeeWhere: {
        role: "USER";
        id?: never;
    };
} | {
    employeeWhere: {
        id?: never;
        role?: never;
    };
} | {
    employeeWhere: {
        id: string;
        role: "USER";
    };
};
export {};
//# sourceMappingURL=employee-scope.util.d.ts.map