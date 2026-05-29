import { Request, Response, NextFunction } from 'express';
import { gradeService } from '../services/grade.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';

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

      return ApiResponse.created(res, "Lưu kết quả chấm điểm báo cáo môn học thành công", grade);
    } catch (error) {
      return next(error);
    }
  }

  async getGradeBySubmissionId(req: Request, res: Response, next: NextFunction) {
    try {
      const { submissionId } = req.params;
      const grade = await gradeService.getGradeBySubmissionId(submissionId);
      return ApiResponse.success(res, "Lấy kết quả điểm số chi tiết của bài nộp thành công", grade);
    } catch (error) {
      return next(error);
    }
  }
}

export const gradeController = new GradeController();
