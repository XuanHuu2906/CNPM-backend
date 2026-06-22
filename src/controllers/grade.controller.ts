import { Request, Response, NextFunction } from 'express';
import { gradeService } from '../services/grade.service';
import { submissionRepository } from '../repositories/submission.repository';
import { ApiResponse, BadRequestError, ForbiddenError } from '../utils/apiResponse';
import { auditLog } from '../utils/audit';
import { UserRole, SubmissionStatus } from '@prisma/client';

export class GradeController {
  async submitGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const { rubricId, detailedScores, feedback, version, isDraft } = req.body;
      const teacherId = req.user?.actorId;

      if (!teacherId) {
        throw new BadRequestError("Tác nhân thực hiện chấm điểm phải là Giảng viên");
      }

      const grade = await gradeService.submitGrade(
        submissionId,
        teacherId,
        { rubricId, detailedScores, feedback, version, isDraft }
      );

      // UC-I04: ghi audit chấm điểm (nháp / chính thức)
      await auditLog(
        req.user?.id ?? null,
        isDraft ? 'CHAM_DIEM_NHAP' : 'CHAM_DIEM_CHINH_THUC',
        `Chấm điểm bài nộp ${submissionId} (rubric=${rubricId}, isDraft=${!!isDraft})`,
        req.ip,
      );

      return ApiResponse.created(res, "Lưu kết quả chấm điểm báo cáo môn học thành công", grade);
    } catch (error) {
      return next(error);
    }
  }

  async getGradeBySubmissionId(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;

      // Sinh viên chỉ được xem điểm khi Phòng Đào Tạo đã duyệt (status = HOAN_THANH)
      if (req.user?.role === UserRole.STUDENT) {
        const submission = await submissionRepository.findSubmissionById(submissionId);
        if (!submission) {
          throw new BadRequestError('Không tìm thấy bài nộp');
        }
        if (submission.status !== SubmissionStatus.HOAN_THANH) {
          throw new ForbiddenError('Điểm chưa được Phòng Đào Tạo duyệt. Vui lòng quay lại sau khi có kết quả chính thức.');
        }
      }

      const grade = await gradeService.getGradeBySubmissionId(submissionId);
      return ApiResponse.success(res, "Lấy kết quả điểm số chi tiết của bài nộp thành công", grade);
    } catch (error) {
      return next(error);
    }
  }
}

export const gradeController = new GradeController();
