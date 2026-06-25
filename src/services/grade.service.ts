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

    // B5 / UC-17 (R12): Xác minh GV được phân công LHP của bài nộp này (Assignment-based,
    // KHÔNG so sánh với existingGrade.teacherId). Lý do: khi PĐT đổi GV phụ trách giữa kỳ,
    // điểm nháp của GV cũ vẫn còn (Grade.teacherId giữ nguyên để audit), nhưng GV mới phải sửa
    // được. Đừng thêm check `existingGrade.teacherId === teacherId` ở dưới — sẽ break UC-17.
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

  // ==========================================
  // UC-09 / UC-I05 EXT: ĐIỀU CHỈNH HỆ SỐ ĐÓNG GÓP THÀNH VIÊN NHÓM
  // ==========================================
  // Quy tắc R11:
  //  - Điểm nhóm áp 100% cho mọi thành viên mặc định (hệ số 1.0).
  //  - GV phụ trách lớp được điều chỉnh hệ số 0–1.5 trước khi gửi duyệt (CHO_DUYET).
  //  - Đóng băng sau khi bài chuyển sang CHO_DUYET / HOAN_THANH (PĐT đã / đang duyệt).
  //  - Áp dụng cho submission có groupId (bài nhóm). Bài cá nhân: không áp dụng.
  async setMemberAdjustments(
    submissionId: string,
    teacherId: string,
    actorUserId: string,
    items: Array<{ studentId: string; contributionFactor: number; note?: string }>,
  ) {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài nộp');
    }
    if (!submission.groupId) {
      throw new BadRequestError('Bài nộp cá nhân không có hệ số đóng góp thành viên');
    }
    const classId = submission.group?.classId;
    if (!classId) {
      throw new BadRequestError('Không xác định được lớp học phần của bài nộp');
    }

    await verifyTeacherClassOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    // Khóa sau khi gửi duyệt — PĐT đã / đang xét.
    if (
      submission.status === SubmissionStatus.CHO_DUYET ||
      submission.status === SubmissionStatus.HOAN_THANH
    ) {
      throw new ForbiddenError('Bài nộp đang chờ duyệt hoặc đã hoàn thành — không thể điều chỉnh hệ số đóng góp');
    }

    const grade = await gradeRepository.findGradeBySubmissionId(submissionId);
    if (!grade) {
      throw new BadRequestError('Chưa có điểm chấm — vui lòng chấm điểm nhóm trước khi điều chỉnh hệ số');
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Danh sách điều chỉnh hệ số rỗng');
    }
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId: submission.groupId },
      select: { studentId: true },
    });
    const memberIds = new Set(groupMembers.map(m => m.studentId));
    const seen = new Set<string>();
    for (const it of items) {
      if (!memberIds.has(it.studentId)) {
        throw new BadRequestError(`Sinh viên ${it.studentId} không thuộc nhóm của bài nộp này`);
      }
      if (seen.has(it.studentId)) {
        throw new BadRequestError(`Sinh viên ${it.studentId} bị trùng trong danh sách điều chỉnh`);
      }
      seen.add(it.studentId);
      if (typeof it.contributionFactor !== 'number' || Number.isNaN(it.contributionFactor)) {
        throw new BadRequestError('Hệ số đóng góp phải là số');
      }
      if (it.contributionFactor < 0 || it.contributionFactor > 1.5) {
        throw new BadRequestError(`Hệ số đóng góp phải nằm trong [0, 1.5] (gửi: ${it.contributionFactor})`);
      }
    }

    // Upsert per item.
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        await tx.gradeMemberAdjustment.upsert({
          where: { gradeId_studentId: { gradeId: grade.id, studentId: it.studentId } },
          create: {
            gradeId: grade.id,
            studentId: it.studentId,
            contributionFactor: it.contributionFactor,
            note: it.note?.trim() || null,
            adjustedById: actorUserId,
          },
          update: {
            contributionFactor: it.contributionFactor,
            note: it.note?.trim() || null,
            adjustedById: actorUserId,
          },
        });
      }
    });

    return await this.getGradeWithMemberScores(submissionId);
  }

  /**
   * Trả về điểm nhóm + danh sách thành viên kèm hệ số + điểm cá nhân tính sẵn.
   * Nếu requestStudentId truyền vào: lọc chỉ trả record của SV đó (R5/R6 cho SV).
   */
  async getGradeWithMemberScores(submissionId: string, requestStudentId?: string) {
    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài nộp');
    }

    const grade = await gradeRepository.findGradeBySubmissionId(submissionId);
    if (!grade) {
      throw new NotFoundError('Bài nộp này chưa có điểm chấm');
    }

    // Bài cá nhân — không có nhóm.
    if (!submission.groupId) {
      const member = submission.studentId === requestStudentId || !requestStudentId
        ? [{
            studentId: submission.studentId!,
            fullName: submission.student?.user?.fullName ?? null,
            studentCode: submission.student?.studentCode ?? null,
            contributionFactor: 1,
            note: null as string | null,
            personalScore: clampPersonalScore(Number(grade.finalScore) * 1),
          }]
        : [];
      return {
        submissionId,
        groupId: null,
        groupScore: Number(grade.finalScore),
        members: member,
      };
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: submission.groupId },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    const adjustments = await prisma.gradeMemberAdjustment.findMany({
      where: { gradeId: grade.id },
    });
    const adjByStudent = new Map(adjustments.map(a => [a.studentId, a]));

    const groupScore = Number(grade.finalScore);
    let memberRows = members.map(m => {
      const adj = adjByStudent.get(m.studentId);
      const factor = adj ? Number(adj.contributionFactor) : 1;
      return {
        studentId: m.studentId,
        fullName: m.student.user.fullName,
        studentCode: m.student.studentCode,
        contributionFactor: factor,
        note: adj?.note ?? null,
        personalScore: clampPersonalScore(groupScore * factor),
      };
    });

    if (requestStudentId) {
      memberRows = memberRows.filter(r => r.studentId === requestStudentId);
    }

    return {
      submissionId,
      groupId: submission.groupId,
      groupScore,
      members: memberRows,
    };
  }
}

function clampPersonalScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  const clamped = Math.max(0, Math.min(10, value));
  return Math.round(clamped * 100) / 100;
}

export const gradeService = new GradeService();
