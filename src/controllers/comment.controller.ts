import { Request, Response, NextFunction } from 'express';
import { commentService } from '../services/comment.service';
import { ApiResponse } from '../utils/apiResponse';

export class CommentController {
  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;
      const comment = await commentService.addComment(submissionId, userId, content);
      return ApiResponse.created(res, 'Thêm bình luận thành công', comment);
    } catch (error) {
      return next(error);
    }
  }

  async getComments(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const comments = await commentService.getComments(submissionId);
      return ApiResponse.success(res, 'Lấy danh sách bình luận thành công', comments);
    } catch (error) {
      return next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      await commentService.deleteComment(id, userId);
      return ApiResponse.success(res, 'Xóa bình luận thành công');
    } catch (error) {
      return next(error);
    }
  }
}
export const commentController = new CommentController();
