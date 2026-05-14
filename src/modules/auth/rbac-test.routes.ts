import { Router } from "express";
import { Role } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { allowRoles } from "../../middlewares/rbac.middleware";

const router = Router();

router.get(
  "/admin-test",
  authMiddleware,
  allowRoles(Role.ADMIN, Role.SUPER_ADMIN),
  (_req, res) => {
    res.json({
      success: true,
      message: "ADMIN or SUPER_ADMIN access granted",
    });
  },
);

router.get(
  "/super-admin-test",
  authMiddleware,
  allowRoles(Role.SUPER_ADMIN),
  (_req, res) => {
    res.json({
      success: true,
      message: "SUPER_ADMIN access granted",
    });
  },
);

export default router;
