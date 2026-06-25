import { commentRepository } from '../repositories/comment.repository';
import { submissionRepository } from '../repositories/submission.repository';
import { NotFoundError, ForbiddenError } from '../utils/apiResponse';

export class CommentService {
  async addComment(submissionId: string, userId: string, content: string) {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Bài nộp không tồn tại');

    return await commentRepository.create({ submissionId, userId, content });
  }

  async getComments(submissionId: string) {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Bài nộp không tồn tại');

    return await commentRepository.findBySubmissionId(submissionId);
  }

  /**
   * B20: chỉ chủ ghi chú (hoặc Admin) được xoá.
   */
  async deleteComment(commentId: string, userId: string, isAdmin: boolean = false) {
    const comment = await commentRepository.findById(commentId);
    if (!comment) throw new NotFoundError('Ghi chú nội bộ không tồn tại');
    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenError('Bạn không có quyền xoá ghi chú nội bộ này');
    }

    return await commentRepository.softDelete(commentId);
  }
}
export const commentService = new CommentService();
