import { Request, Response } from 'express';
import { ApiResponse, BadRequestError, ForbiddenError } from '../utils/apiResponse';
import { gradeAppealService } from '../services/grade-appeal.service';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { auditLog } from '../utils/audit';

export class GradeAppealController {
  async createAppeal(req: Request, res: Response) {
    const { submissionId } = req.params;
    const { reason } = req.body;

    if (req.user?.role !== UserRole.STUDENT) {
      throw new ForbiddenError('Chỉ sinh viên mới được gửi phúc khảo');
    }

    const stu = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!stu) {
      throw new BadRequestError('Không tìm thấy thông tin sinh viên');
    }

    const request = await gradeAppealService.createAppeal(stu.id, submissionId, reason);
    await auditLog(
      req.user.id,
      'TAO_YEU_CAU_PHUC_KHAO',
      `SV gửi phúc khảo cho submission ${submissionId}`,
      req.ip,
    );
    return ApiResponse.created(res, 'Đã gửi yêu cầu phúc khảo tới Phòng Đào tạo', {
      requestId: request.id,
    });
  }

  async createAppealByAcademic(req: Request, res: Response) {
    const { submissionId } = req.params;
    const { reason } = req.body;

    if (req.user?.role !== UserRole.ACADEMIC_DEPT && req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Chỉ Phòng Đào tạo/Admin mới được tạo yêu cầu phúc khảo trực tiếp');
    }

    const result = await gradeAppealService.createAppealByAcademic(
      submissionId,
      req.user!.id,
      reason,
    );
    await auditLog(
      req.user.id,
      'PDT_TAO_YEU_CAU_PHUC_KHAO',
      `PĐT tạo yêu cầu phúc khảo cho submission ${submissionId}`,
      req.ip,
    );
    return ApiResponse.created(res, result.message, result.request);
  }

  async getMyAppeals(req: Request, res: Response) {
    if (req.user?.role !== UserRole.STUDENT) {
      throw new ForbiddenError('Chỉ sinh viên mới có thể xem');
    }
    const stu = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!stu) throw new BadRequestError('Không tìm thấy thông tin sinh viên');
    const data = await gradeAppealService.getMyAppeals(stu.id);
    return ApiResponse.success(res, 'Lấy danh sách phúc khảo của bạn', data);
  }

  async listForAcademic(req: Request, res: Response) {
    const { status, classId } = req.query;
    const data = await gradeAppealService.listForAcademic({
      status: status as string | undefined,
      classId: classId as string | undefined,
    });
    return ApiResponse.success(res, 'Danh sách yêu cầu phúc khảo', data);
  }

  async approveAppeal(req: Request, res: Response) {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const result = await gradeAppealService.approveAppeal(id, req.user!.id, reviewNote);
    await auditLog(
      req.user?.id ?? null,
      'DUYET_YEU_CAU_PHUC_KHAO',
      `PĐT duyệt phúc khảo ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, result.message);
  }

  async rejectAppeal(req: Request, res: Response) {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const result = await gradeAppealService.rejectAppeal(id, req.user!.id, reviewNote);
    await auditLog(
      req.user?.id ?? null,
      'TU_CHOI_YEU_CAU_PHUC_KHAO',
      `PĐT từ chối phúc khảo ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, result.message);
  }
}

export const gradeAppealController = new GradeAppealController();
