import { EmployeeStatus, Role, SalaryType } from "@prisma/client";
type CreateEmployeeInput = {
    employeeCode: string;
    name: string;
    email?: string;
    password: string;
    phone: string;
    address?: string;
    designation?: string;
    department?: string;
    joiningDate: Date;
    salaryType: SalaryType;
    role: Role;
    profileImage?: string;
};
export declare class EmployeeRepository {
    static create(data: CreateEmployeeInput): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findByEmail(email: string): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        password: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findByPhone(phone: string): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        password: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static findById(id: string): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static countEmployees(): import(".prisma/client").Prisma.PrismaPromise<number>;
    static list(params: {
        search?: string;
        status?: EmployeeStatus;
        role?: Role;
        salaryType?: SalaryType;
        department?: string;
        skip: number;
        take: number;
    }): Promise<[{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[], number]>;
    static update(id: string, data: any): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static updateStatus(id: string, status: EmployeeStatus): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static updateRole(id: string, role: Role): import(".prisma/client").Prisma.Prisma__EmployeeClient<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        address: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, {
        adapter: import("@prisma/adapter-pg").PrismaPg;
        log: ("query" | "warn" | "error")[];
    }>;
    static defaultSelect(): {
        id: boolean;
        employeeCode: boolean;
        name: boolean;
        email: boolean;
        phone: boolean;
        address: boolean;
        designation: boolean;
        department: boolean;
        joiningDate: boolean;
        salaryType: boolean;
        status: boolean;
        role: boolean;
        profileImage: boolean;
        createdAt: boolean;
        updatedAt: boolean;
    };
}
export {};
//# sourceMappingURL=employee.repository.d.ts.map