import { Request, Response, NextFunction } from 'express';
import { commentService } from '../services/comment.service';
import { ApiResponse } from '../utils/apiResponse';
import { auditLog } from '../utils/audit';

/**
 * B20: controller phục vụ "Ghi chú nội bộ giảng viên" (route /internal-notes).
 * Tầng repo/service vẫn dùng tên `Comment` (model Prisma) để tránh migration.
 */
export class CommentController {
  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;
      const note = await commentService.addComment(submissionId, userId, content);

      await auditLog(
        userId,
        'TAO_GHI_CHU_NOI_BO',
        `GV thêm ghi chú nội bộ vào submission ${submissionId}`,
        req.ip,
      );

      return ApiResponse.created(res, 'Thêm ghi chú nội bộ thành công', note);
    } catch (error) {
      return next(error);
    }
  }

  async getComments(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const notes = await commentService.getComments(submissionId);
      return ApiResponse.success(res, 'Lấy danh sách ghi chú nội bộ thành công', notes);
    } catch (error) {
      return next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'ADMIN';
      await commentService.deleteComment(id, userId, isAdmin);

      await auditLog(
        userId,
        'XOA_GHI_CHU_NOI_BO',
        `Xoá ghi chú nội bộ ${id}`,
        req.ip,
      );

      return ApiResponse.success(res, 'Xoá ghi chú nội bộ thành công');
    } catch (error) {
      return next(error);
    }
  }
}
export const commentController = new CommentController();
