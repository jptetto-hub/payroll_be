import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { loginSchema } from "./auth.validator";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

router.post("/login", authRateLimiter, validate(loginSchema), AuthController.login);

router.post("/logout", authMiddleware, AuthController.logout);

router.get("/me", authMiddleware, AuthController.me);

export default router;
