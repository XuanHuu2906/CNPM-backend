import { editRequestRepository } from '../repositories/edit-request.repository';
import { submissionRepository } from '../repositories/submission.repository';
import { NotFoundError } from '../utils/apiResponse';

export class EditRequestService {
  async createEditRequest(submissionId: string, teacherId: string, content: string) {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Bài nộp không tồn tại');

    return await editRequestRepository.create({ submissionId, teacherId, content });
  }

  async getEditRequests(submissionId: string) {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Bài nộp không tồn tại');

    return await editRequestRepository.findBySubmissionId(submissionId);
  }
}
export const editRequestService = new EditRequestService();
