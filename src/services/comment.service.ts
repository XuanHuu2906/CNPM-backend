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

  async deleteComment(commentId: string, userId: string) {
    const comment = await commentRepository.findById(commentId);
    if (!comment) throw new NotFoundError('Bình luận không tồn tại');
    if (comment.userId !== userId) throw new ForbiddenError('Bạn không có quyền xóa bình luận này');

    return await commentRepository.softDelete(commentId);
  }
}
export const commentService = new CommentService();
