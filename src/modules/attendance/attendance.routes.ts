import { Router } from "express";
import { Role } from "@prisma/client";
import { AttendanceController } from "./attendance.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  bulkAttendanceSchema,
  createAttendanceSchema,
  rangeQuerySchema,
  updateAttendanceSchema,
  bulkDeleteAttendanceSchema,
  bulkUpdateAttendanceSchema,
} from "./attendance.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(createAttendanceSchema),
  AttendanceController.create,
);

router.post(
  "/bulk",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(bulkAttendanceSchema),
  AttendanceController.bulk,
);

router.get(
  "/",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  AttendanceController.list,
);

router.get(
  "/employee/:employeeId",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  AttendanceController.listByEmployee,
);

router.get(
  "/employee/:employeeId/range",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  validate(rangeQuerySchema),
  AttendanceController.listByRange,
);

router.patch(
  "/bulk/update",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(bulkUpdateAttendanceSchema),
  AttendanceController.bulkUpdate,
);

router.delete(
  "/bulk/delete",
  allowRoles(Role.SUPER_ADMIN),
  validate(bulkDeleteAttendanceSchema),
  AttendanceController.bulkDelete,
);

router.patch(
  "/:id",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  validate(updateAttendanceSchema),
  AttendanceController.update,
);

router.delete(
  "/:id",
  allowRoles(Role.SUPER_ADMIN),
  AttendanceController.delete,
);

export default router;
