import { gradeRepository } from '../repositories/grade.repository';
import { submissionRepository } from '../repositories/submission.repository';
import { rubricService } from './rubric.service';
import { academicService } from './academic.service';
import { notificationService } from './notification.service';
import { prisma } from '../config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/apiResponse';
import { verifyTeacherClassOwnership } from '../utils/ownership';
import { Grade, SubmissionStatus } from '@prisma/client';

export class GradeService {
  /**
   * Giảng viên chấm điểm chi tiết bài nộp của sinh viên theo tiêu chí Rubric
   */
  async submitGrade(
    submissionId: string,
    teacherId: string,
    data: {
      rubricId: string;
      detailedScores: Array<{ criteriaId: string; score: number }>;
      feedback?: string;
      version: number; // Đây là số phiên bản Grade hiện có nếu sửa điểm (mặc định gửi lên 1 nếu chấm mới)
      isDraft?: boolean;
    }
  ): Promise<Grade> {
    // 1. Tìm thông tin bài báo cáo bài nộp
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError("Không tìm thấy thông tin bài báo cáo bài nộp cần chấm điểm");
    }

    // B5: Xác minh GV được phân công LHP của bài nộp này.
    // B8: nếu bài nộp cá nhân (không group), lookup classId qua Enrollment của SV.
    let classId: string | undefined = submission.group?.classId;
    if (!classId && submission.studentId) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { studentId: submission.studentId },
        orderBy: { createdAt: 'desc' },
        select: { classId: true },
      });
      classId = enrollment?.classId;
    }
    if (!classId) {
      throw new BadRequestError('Không xác định được lớp học phần của bài nộp này.');
    }
    await verifyTeacherClassOwnership(classId, teacherId);

    // B7: Chặn cập nhật điểm khi bài đã chấm xong / chờ duyệt / hoàn thành.
    // GV phải gửi yêu cầu mở lại chấm điểm để chỉnh sửa.
    const lockedStatuses: SubmissionStatus[] = [
      SubmissionStatus.DA_CHAM,
      SubmissionStatus.CHO_DUYET,
      SubmissionStatus.HOAN_THANH,
    ];
    const existingGrade = await gradeRepository.findGradeBySubmissionId(submissionId);
    if (existingGrade && lockedStatuses.includes(submission.status as SubmissionStatus)) {
      throw new ForbiddenError(
        'Bài nộp đã được chấm. Vui lòng gửi yêu cầu mở lại chấm điểm để chỉnh sửa.'
      );
    }
    if (existingGrade && existingGrade.isApproved) {
      throw new BadRequestError("Bảng điểm của bài báo cáo này đã được Phòng Đào Tạo phê duyệt chính thức. Không thể chỉnh sửa điểm số!");
    }

    if (submission.status === SubmissionStatus.CHUA_NOP) {
      throw new BadRequestError("Báo cáo môn học này đang ở trạng thái chưa nộp bài. Không thể tiến hành chấm điểm!");
    }

    // 2. Chốt chặn học kỳ: Kiểm tra học kỳ chứa lớp học phần này đã bị khóa điểm hay chưa
    await academicService.verifyTermActive(classId);

    // 3. Tìm thông tin Rubric và mảng tiêu chí chi tiết Criteria
    const rubric = await rubricService.getRubricById(data.rubricId);

    // 4. So khớp và kiểm tra tính hợp lệ của mảng điểm số gửi lên
    if (data.detailedScores.length !== rubric.criteria.length) {
      throw new BadRequestError(`Số lượng tiêu chí gửi lên để chấm (${data.detailedScores.length}) không trùng khớp với số lượng tiêu chí được thiết lập trong Rubric (${rubric.criteria.length})`);
    }

    let calculatedFinalScore = 0;

    // Duyệt qua từng tiêu chí được cấu hình trong Rubric để so khớp điểm số
    for (const criterion of rubric.criteria) {
      const match = data.detailedScores.find((s) => s.criteriaId === criterion.id);
      if (!match) {
        throw new BadRequestError(`Thiếu điểm chấm cho tiêu chí con '${criterion.name}' thuộc bảng Rubric`);
      }

      const score = match.score;

      // Chốt chặn điểm âm hoặc vượt điểm tối đa
      const maxScore = Number(criterion.maxScore);
      const weight = Number(criterion.weight);

      if (score < 0 || score > maxScore) {
        throw new BadRequestError(`Điểm chấm cho tiêu chí '${criterion.name}' không hợp lệ. Phải nằm trong khoảng từ 0 đến điểm tối đa ${maxScore} (Điểm gửi lên: ${score})`);
      }

      // Điểm thành phần sau khi nhân trọng số (weight %)
      calculatedFinalScore += score * (weight / 100);
    }

    // Làm tròn điểm tổng cuối cùng đến 2 chữ số thập phân
    calculatedFinalScore = Math.round(calculatedFinalScore * 100) / 100;

    // 5. Tiến hành lưu mới hoặc cập nhật điểm chấm chi tiết (OCC)
    const grade = await gradeRepository.upsertGradeWithOCC(
      submissionId,
      {
        rubricId: data.rubricId,
        teacherId,
        detailedScores: data.detailedScores,
        finalScore: calculatedFinalScore,
        feedback: data.feedback,
      },
      data.version
    );

    // 6. Cập nhật trạng thái bài nộp của sinh viên thành DA_CHAM kèm ghi logs và OCC (nếu không phải là lưu nháp)
    if (!data.isDraft) {
      await submissionRepository.updateSubmissionStatusWithOCC(
        submissionId,
        submission.version,
        {
          status: 'DA_CHAM' as SubmissionStatus, // Casting to avoid undefined if prisma client is broken
          note: "Hệ thống tự động chuyển đổi trạng thái báo cáo sau khi Giảng viên chấm điểm thành công",
        },
        teacherId
      );

      // Gửi thông báo cho sinh viên về kết quả chấm điểm
      const userIds: string[] = [];
      if (submission.student?.userId) {
        userIds.push(submission.student.userId);
      } else if (submission.group?.members) {
        submission.group.members.forEach((m: any) => {
          if (m.student?.userId) userIds.push(m.student.userId);
        });
      }
      for (const uid of userIds) {
        await notificationService.createNotification({
          userId: uid,
          title: 'Bài nộp đã được chấm điểm',
          content: `Bài nộp môn học của bạn đã được giảng viên chấm điểm. Vui lòng kiểm tra kết quả.`,
          type: 'TRANG_THAI',
          submissionId,
        });
      }
    }

    return grade;
  }

  /**
   * Xem kết quả chấm điểm chi tiết của bài nộp
   */
  async getGradeBySubmissionId(submissionId: string): Promise<Grade> {
    const grade = await gradeRepository.findGradeBySubmissionId(submissionId);
    if (!grade) {
      throw new NotFoundError("Bài nộp này hiện tại chưa có kết quả chấm điểm");
    }
    return grade;
  }
}

export const gradeService = new GradeService();
