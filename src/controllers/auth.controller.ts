import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';

export class AuthController {
  /**
   * Đăng nhập hệ thống (UC-01)
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return ApiResponse.success(res, "Đăng nhập thành công!", result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Đổi mật khẩu cá nhân (UC-02)
   */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id; // Có sẵn từ auth middleware
      const { oldPassword, newPassword } = req.body;
      await authService.changePassword(userId, oldPassword, newPassword);
      return ApiResponse.success(res, "Đổi mật khẩu thành công!");
    } catch (error) {
      return next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      return ApiResponse.success(res, result.message, result);
    } catch (error) {
      return next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      return ApiResponse.success(res, "Đặt lại mật khẩu thành công!", result);
    } catch (error) {
      return next(error);
    }
  }
}
export const authController = new AuthController();
