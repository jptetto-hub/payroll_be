import { Router } from "express";
import { Role } from "@prisma/client";
import { ReportsController } from "./reports.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";

const router = Router();

router.use(authMiddleware);

router.get(
  "/salary",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  ReportsController.salary,
);

router.get(
  "/salary/export",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.salaryExport,
);

router.get(
  "/attendance",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  ReportsController.attendance,
);

router.get(
  "/attendance/export",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.attendanceExport,
);

router.get(
  "/advance",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  ReportsController.advance,
);

router.get(
  "/advance/export",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.advanceExport,
);

router.get(
  "/salary/export/excel",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.salaryExportExcel,
);

router.get(
  "/attendance/export/excel",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.attendanceExportExcel,
);

router.get(
  "/advance/export/excel",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.advanceExportExcel,
);

router.get(
  "/all-in-one/export/excel",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.allInOneExportExcel,
);

router.get(
  "/all-in-one/export",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  ReportsController.allInOneExport,
);

router.get(
  "/all-in-one",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  ReportsController.allInOne,
);

export default router;
