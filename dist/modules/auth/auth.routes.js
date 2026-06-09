"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const auth_validator_1 = require("./auth.validator");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rateLimit_middleware_1 = require("../../middlewares/rateLimit.middleware");
const router = (0, express_1.Router)();
router.post("/login", rateLimit_middleware_1.authRateLimiter, (0, validate_middleware_1.validate)(auth_validator_1.loginSchema), auth_controller_1.AuthController.login);
router.post("/logout", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.logout);
router.get("/me", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.me);
router.post("/session/activity", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.activity);
router.get("/session/status", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.sessionStatus);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map