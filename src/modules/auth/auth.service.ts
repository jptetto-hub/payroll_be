import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";
import { AuthSessionService } from "./auth-session.service";

export class AuthService {
  static async login(phone: string, password: string) {
    const employee = await prisma.employee.findUnique({
      where: { phone },
    });

    if (!employee) {
      throw new Error("Invalid phone number or password");
    }

    if (employee.status !== "ACTIVE") {
      throw new Error("Employee account is inactive");
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password);

    if (!isPasswordValid) {
      throw new Error("Invalid phone number or password");
    }

    const { token } = await AuthSessionService.create({
      id: employee.id,
      phone: employee.phone,
      email: employee.email,
      role: employee.role,
    });

    return {
      token,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        phone: employee.phone,
        email: employee.email,
        role: employee.role,
        joiningDate: employee.joiningDate,
        salaryType: employee.salaryType,
      },
    };
  }

  static async getMe(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        joiningDate: true,
        salaryType: true,
        status: true,
        role: true,
        profileImage: true,
        createdAt: true,
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    return employee;
  }
}
