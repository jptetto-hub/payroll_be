import { Role, SalaryType, EmployeeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma";

async function main() {
  const password = await bcrypt.hash("Admin@123", 10);

  const superAdmin = await prisma.employee.upsert({
    where: { phone: "9597224123" },
    update: {},
    create: {
      employeeCode: "EMP001",
      name: "Super Admin",
      email: "superadmin@payroll.com",
      phone: "9597224123",
      password,
      designation: "Owner",
      department: "Management",
      joiningDate: new Date(),
      salaryType: SalaryType.MONTHLY,
      status: EmployeeStatus.ACTIVE,
      role: Role.SUPER_ADMIN,
    },
  });

  await prisma.systemSetting.upsert({
    where: { id: "default-settings" },
    update: {},
    create: {
      id: "default-settings",
      weekStartsOn: "MONDAY",
      autoPayrollEnabled: true,
    },
  });

  console.log("Seed completed:", superAdmin.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
