import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { loginSchema } from "./auth.validator";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/login", validate(loginSchema), AuthController.login);

router.get("/me", authMiddleware, AuthController.me);

export default router;
