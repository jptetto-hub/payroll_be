export declare class AuthService {
    static login(phone: string, password: string): Promise<{
        token: string;
        employee: {
            id: string;
            employeeCode: string;
            name: string;
            phone: string;
            email: string | null;
            role: import(".prisma/client").$Enums.Role;
            joiningDate: Date;
            salaryType: import(".prisma/client").$Enums.SalaryType;
        };
    }>;
    static getMe(employeeId: string): Promise<{
        id: string;
        employeeCode: string;
        email: string | null;
        phone: string;
        name: string;
        designation: string | null;
        department: string | null;
        joiningDate: Date;
        salaryType: import(".prisma/client").$Enums.SalaryType;
        status: import(".prisma/client").$Enums.EmployeeStatus;
        role: import(".prisma/client").$Enums.Role;
        profileImage: string | null;
        createdAt: Date;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map