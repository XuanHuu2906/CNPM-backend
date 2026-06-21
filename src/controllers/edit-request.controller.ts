import { Request, Response, NextFunction } from 'express';
import { editRequestService } from '../services/edit-request.service';
import { ApiResponse } from '../utils/apiResponse';

export class EditRequestController {
  async createEditRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const { content } = req.body;
      const teacherId = req.user!.actorId;
      const editRequest = await editRequestService.createEditRequest(submissionId, teacherId, content);
      return ApiResponse.created(res, 'Gửi yêu cầu chỉnh sửa thành công', editRequest);
    } catch (error) {
      return next(error);
    }
  }

  async getEditRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const editRequests = await editRequestService.getEditRequests(submissionId);
      return ApiResponse.success(res, 'Lấy danh sách yêu cầu chỉnh sửa thành công', editRequests);
    } catch (error) {
      return next(error);
    }
  }
}
export const editRequestController = new EditRequestController();
