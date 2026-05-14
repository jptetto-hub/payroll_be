import { Router } from "express";
import { Role } from "@prisma/client";
import { AttendanceRequestController } from "./attendance-request.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  attendanceRequestDateFilterSchema,
  attendanceRequestDecisionSchema,
  createAttendanceRequestSchema,
  rejectAttendanceRequestSchema,
} from "./attendance-request.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  allowRoles(Role.USER),
  validate(createAttendanceRequestSchema),
  AttendanceRequestController.create,
);

router.get(
  "/my",
  allowRoles(Role.USER),
  validate(attendanceRequestDateFilterSchema),
  AttendanceRequestController.myRequests,
);

router.get(
  "/pending",
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER),
  validate(attendanceRequestDateFilterSchema),
  AttendanceRequestController.pendingRequests,
);

router.patch(
  "/decision",
  allowRoles(Role.SUPER_ADMIN),
  validate(attendanceRequestDecisionSchema),
  AttendanceRequestController.decision,
);

router.patch(
  "/:id/approve",
  allowRoles(Role.SUPER_ADMIN),
  AttendanceRequestController.approve,
);

router.patch(
  "/:id/reject",
  allowRoles(Role.SUPER_ADMIN),
  validate(rejectAttendanceRequestSchema),
  AttendanceRequestController.reject,
);

router.delete(
  "/:id",
  allowRoles(Role.USER),
  AttendanceRequestController.deleteOwn,
);

export default router;
