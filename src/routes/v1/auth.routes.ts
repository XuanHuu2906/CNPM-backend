import { Router } from 'express';
import { authController } from '../../controllers/auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { loginSchema, changePasswordSchema } from '../../validators/auth.validator';
import { forgotPasswordSchema, resetPasswordSchema } from '../../validators/password-reset.validator';

const router = Router();

// 1. Đăng nhập hệ thống (UC-01) - Không cần token
router.post('/login', validate(loginSchema), authController.login);

// 2. Đổi mật khẩu cá nhân (UC-02) - Cần token xác thực
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

// 3. Quên mật khẩu - Gửi yêu cầu reset (UC-I04)
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

// 4. Đặt lại mật khẩu với token (UC-I04)
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;
