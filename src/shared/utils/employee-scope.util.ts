import { Role } from "@prisma/client";
import { AppError } from "./app-error";

type EmployeeScopeParams = {
  authUser: {
    id: string;
    role: Role;
  };
  employeeId?: string | undefined;
};

export const resolveEmployeeScope = ({
  authUser,
  employeeId,
}: EmployeeScopeParams) => {
  if (!employeeId) {
    if (authUser.role === Role.USER) {
      return {
        employeeWhere: {
          id: authUser.id,
        },
      };
    }

    if (authUser.role === Role.ADMIN) {
      return {
        employeeWhere: {
          role: Role.USER,
        },
      };
    }

    return {
      employeeWhere: {},
    };
  }

  if (employeeId === "all") {
    if (authUser.role === Role.USER) {
      throw new AppError("USER cannot access all employees data", 403);
    }

    if (authUser.role === Role.ADMIN) {
      return {
        employeeWhere: {
          role: Role.USER,
        },
      };
    }

    return {
      employeeWhere: {},
    };
  }

  if (authUser.role === Role.USER && employeeId !== authUser.id) {
    throw new AppError("You can access only your own data", 403);
  }

  if (authUser.role === Role.ADMIN) {
    return {
      employeeWhere: {
        id: employeeId,
        role: Role.USER,
      },
    };
  }

  return {
    employeeWhere: {
      id: employeeId,
    },
  };
};
