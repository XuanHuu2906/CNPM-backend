import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { ApiResponse } from '../utils/apiResponse';

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await notificationService.getNotifications(userId, page, limit);
      return ApiResponse.success(res, 'Lấy danh sách thông báo thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  async countUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const count = await notificationService.countUnread(userId);
      return ApiResponse.success(res, 'Lấy số lượng thông báo chưa đọc thành công', { count });
    } catch (error) {
      return next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await notificationService.markAsRead(id, req.user!.id);
      return ApiResponse.success(res, 'Đánh dấu đã đọc thông báo thành công');
    } catch (error) {
      return next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      await notificationService.markAllAsRead(userId);
      return ApiResponse.success(res, 'Đánh dấu tất cả thông báo đã đọc thành công');
    } catch (error) {
      return next(error);
    }
  }
}
export const notificationController = new NotificationController();
