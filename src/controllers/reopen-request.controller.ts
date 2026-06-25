import { Request, Response } from 'express';
import { ApiResponse, BadRequestError, ForbiddenError } from '../utils/apiResponse';
import { reopenRequestService } from '../services/reopen-request.service';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { auditLog } from '../utils/audit';

export class ReopenRequestController {
  async createRequest(req: Request, res: Response) {
    const { submissionId } = req.params;
    const { reason } = req.body;
    
    // Actor must be a teacher
    if (req.user?.role !== UserRole.TEACHER) {
      throw new ForbiddenError('Chỉ giảng viên mới có thể gửi yêu cầu mở lại chấm điểm');
    }

    const teacherUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { teacher: true }
    });

    if (!teacherUser?.teacher) {
      throw new BadRequestError('Không tìm thấy thông tin giảng viên');
    }

    const request = await reopenRequestService.createRequest(
      teacherUser.teacher.id,
      submissionId,
      reason,
      teacherUser.fullName
    );

    await auditLog(
      req.user?.id ?? null,
      'TAO_YEU_CAU_MO_LAI_CHAM',
      `GV gửi yêu cầu mở lại chấm điểm cho submission ${submissionId}`,
      req.ip,
    );

    return ApiResponse.created(res, 'Yêu cầu mở lại chấm điểm đã được gửi đến Phòng Đào tạo', {
      requestId: request.id
    });
  }

  async getRequests(req: Request, res: Response) {
    const { status, classId, semesterId } = req.query;
    // req.user is ACADEMIC_DEPT or ADMIN
    const data = await reopenRequestService.getRequests({ status, classId, semesterId });
    return ApiResponse.success(res, 'Lấy danh sách yêu cầu thành công', data);
  }

  async approveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const result = await reopenRequestService.approveRequest(id, req.user!.id, reviewNote);
    await auditLog(
      req.user?.id ?? null,
      'DUYET_YEU_CAU_MO_LAI_CHAM',
      `PĐT duyệt yêu cầu mở lại chấm ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, result.message);
  }

  async rejectRequest(req: Request, res: Response) {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const result = await reopenRequestService.rejectRequest(id, req.user!.id, reviewNote);
    await auditLog(
      req.user?.id ?? null,
      'TU_CHOI_YEU_CAU_MO_LAI_CHAM',
      `PĐT từ chối yêu cầu mở lại chấm ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, result.message);
  }
}

export const reopenRequestController = new ReopenRequestController();
