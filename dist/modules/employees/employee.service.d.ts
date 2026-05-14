import { EmployeeStatus, Role } from "@prisma/client";
export declare class EmployeeService {
    static createEmployee(data: any, currentUserRole: Role): Promise<{
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
    }>;
    static listEmployees(query: any): Promise<{
        data: {
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
        }[];
        pagination: import("../../shared/utils/pagination.util").PaginationMeta;
    }>;
    static getEmployeeById(id: string): Promise<{
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
    }>;
    static updateEmployee(id: string, data: any, currentUserRole: Role): Promise<{
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
    }>;
    static updateStatus(id: string, status: EmployeeStatus, currentUserRole: Role): Promise<{
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
    }>;
    static updateRole(id: string, role: Role, currentUserRole: Role): Promise<{
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
    }>;
}
//# sourceMappingURL=employee.service.d.ts.map