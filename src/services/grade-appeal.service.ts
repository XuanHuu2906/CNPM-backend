import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/apiResponse';
import { notificationService } from './notification.service';
import { academicService } from './academic.service';
import { SubmissionStatus, UserRole } from '@prisma/client';

// Cửa sổ 14 ngày kể từ thời điểm bài chuyển sang HOAN_THANH (PĐT duyệt điểm).
const APPEAL_WINDOW_DAYS = 14;

type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Phúc khảo điểm (Grade Appeal).
 *
 * Luồng: SV gửi đơn (1 lần duy nhất / submission, trong vòng 14 ngày kể từ
 * HOAN_THANH) → PĐT duyệt trực tiếp → nếu APPROVED thì flip Grade.isApproved=false
 * + Submission.status=DANG_CHAM để GV chấm lại.
 */
export class GradeAppealService {
  async createAppeal(studentId: string, submissionId: string, reason: string) {
    if (!reason || reason.trim().length < 20) {
      throw new BadRequestError('Lý do phúc khảo phải có ít nhất 20 ký tự');
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        group: { include: { members: { select: { studentId: true } }, select: { id: true, classId: true, members: true } } as any },
      },
    });
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài báo cáo');
    }

    // Ownership: SV cá nhân hoặc thành viên nhóm.
    const isOwner =
      submission.studentId === studentId ||
      (submission as any).group?.members?.some((m: any) => m.studentId === studentId);
    if (!isOwner) {
      throw new ForbiddenError('Bạn không có quyền gửi phúc khảo cho bài nộp này');
    }

    // Chỉ phúc khảo khi bài đã chấm xong (DA_CHAM = terminal).
    if (submission.status !== SubmissionStatus.DA_CHAM) {
      throw new BadRequestError('Chỉ được phúc khảo khi bài đã chấm xong');
    }

    // Cửa sổ thời gian: tính từ log gần nhất chuyển sang DA_CHAM.
    const lastApprovedLog = await prisma.submissionLog.findFirst({
      where: { submissionId, newStatus: 'DA_CHAM' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const approvedAt = lastApprovedLog?.createdAt ?? submission.updatedAt;
    const deadline = new Date(approvedAt.getTime() + APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      throw new BadRequestError(
        `Đã quá hạn ${APPEAL_WINDOW_DAYS} ngày kể từ khi điểm được duyệt (hạn cuối: ${deadline.toLocaleDateString('vi-VN')})`,
      );
    }

    // Học kỳ phải còn mở.
    const classId = (submission as any).group?.classId ?? null;
    if (classId) {
      await academicService.verifyTermActive(classId);
    }

    // 1 lần duy nhất / submission.
    const existing = await (prisma as any).gradeAppealRequest.findUnique({
      where: { submissionId },
    });
    if (existing) {
      throw new BadRequestError('Bài nộp này đã có đơn phúc khảo, không thể gửi lại');
    }

    const request = await (prisma as any).gradeAppealRequest.create({
      data: {
        submissionId,
        studentId,
        reason: reason.trim(),
        status: 'PENDING' as AppealStatus,
      },
    });

    // Notify PĐT/Admin.
    try {
      const reviewers = await prisma.user.findMany({
        where: { role: { in: [UserRole.ACADEMIC_DEPT, UserRole.ADMIN] }, isActive: true },
        select: { id: true },
      });
      const stuInfo = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { fullName: true } } },
      });
      const topicName = (submission as any).group?.topicName ?? 'Báo cáo';
      const stuName = stuInfo?.user?.fullName ?? 'Sinh viên';
      for (const r of reviewers) {
        await notificationService.createNotification({
          userId: r.id,
          title: 'Yêu cầu phúc khảo mới',
          content: `${stuName} đã gửi yêu cầu phúc khảo điểm cho bài "${topicName}".`,
          type: 'HE_THONG',
          submissionId,
        });
      }
    } catch {
      // best-effort
    }

    return request;
  }

  /**
   * PĐT chủ động tạo yêu cầu phúc khảo cho bài nộp (thay cho thao tác "trả về chấm lại").
   * Khác với phúc khảo của SV: bỏ qua kiểm tra HOAN_THANH + cửa sổ 14 ngày,
   * và đồng thời tự duyệt luôn (status APPROVED) để bài về DANG_CHAM ngay.
   */
  async createAppealByAcademic(submissionId: string, academicUserId: string, reason: string) {
    if (!reason || reason.trim().length < 20) {
      throw new BadRequestError('Lý do yêu cầu phúc khảo phải có ít nhất 20 ký tự');
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        group: { include: { members: { select: { studentId: true } } } },
      },
    });
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài báo cáo');
    }

    const appellantStudentId =
      submission.studentId ?? (submission as any).group?.members?.[0]?.studentId ?? null;
    if (!appellantStudentId) {
      throw new BadRequestError('Không xác định được sinh viên cho bài nộp này');
    }

    const classId = (submission as any).group?.classId ?? null;
    if (classId) {
      await academicService.verifyTermActive(classId);
    }

    const existing = await (prisma as any).gradeAppealRequest.findUnique({
      where: { submissionId },
    });
    if (existing) {
      throw new BadRequestError('Bài nộp này đã có đơn phúc khảo, không thể tạo thêm');
    }

    const oldStatus = submission.status;
    const note = reason.trim();

    const result = await prisma.$transaction(async (tx: any) => {
      const request = await tx.gradeAppealRequest.create({
        data: {
          submissionId,
          studentId: appellantStudentId,
          reason: note,
          status: 'APPROVED',
          reviewedById: academicUserId,
          reviewNote: 'PĐT chủ động yêu cầu phúc khảo',
          reviewedAt: new Date(),
        },
      });

      const upd = await tx.submission.updateMany({
        where: { id: submissionId, version: submission.version },
        data: { status: SubmissionStatus.DANG_CHAM, version: { increment: 1 } },
      });
      if (upd.count === 0) {
        throw new BadRequestError('Xung đột dữ liệu — vui lòng tải lại trang');
      }

      await tx.submissionLog.create({
        data: {
          submissionId,
          oldStatus,
          newStatus: SubmissionStatus.DANG_CHAM,
          actorId: academicUserId,
          note: `PĐT yêu cầu phúc khảo: ${note}`,
        },
      });

      return request;
    });

    try {
      if (classId) {
        const assigns = await prisma.assignment.findMany({
          where: { classId },
          include: { teacher: { select: { userId: true } } },
        });
        for (const a of assigns) {
          if (!a.teacher?.userId) continue;
          await notificationService.createNotification({
            userId: a.teacher.userId,
            title: 'PĐT yêu cầu phúc khảo / chấm lại',
            content: `Lý do: ${note}`,
            type: 'HE_THONG',
            submissionId,
          });
        }
      }
      const stu = await prisma.student.findUnique({
        where: { id: appellantStudentId },
        select: { userId: true },
      });
      if (stu?.userId) {
        await notificationService.createNotification({
          userId: stu.userId,
          title: 'Bài báo cáo đang được phúc khảo',
          content: 'PĐT đã yêu cầu chấm lại bài báo cáo. Vui lòng chờ điểm mới.',
          type: 'HE_THONG',
          submissionId,
        });
      }
    } catch {
      // best-effort
    }

    return { message: 'Đã tạo yêu cầu phúc khảo và đưa bài về Đang chấm.', request: result };
  }

  async getMyAppeals(studentId: string) {
    return await (prisma as any).gradeAppealRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        submission: {
          select: {
            id: true,
            status: true,
            group: { select: { name: true, topicName: true } },
          },
        },
        reviewer: { select: { fullName: true } },
      },
    });
  }

  async listForAcademic(filters: { status?: string; classId?: string } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.classId) {
      where.submission = { group: { classId: filters.classId } };
    }
    return await (prisma as any).gradeAppealRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: { studentCode: true, user: { select: { fullName: true } } },
        },
        submission: {
          select: {
            id: true,
            status: true,
            version: true,
            group: { select: { name: true, topicName: true, classId: true, class: { select: { classCode: true } } } },
            grades: { select: { finalScore: true } },
          },
        },
        reviewer: { select: { fullName: true } },
      },
    });
  }

  /**
   * PĐT duyệt phúc khảo: gỡ duyệt điểm cũ + đẩy bài về DANG_CHAM để GV chấm lại.
   */
  async approveAppeal(requestId: string, academicUserId: string, reviewNote?: string) {
    const request = await (prisma as any).gradeAppealRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundError('Không tìm thấy yêu cầu phúc khảo');
    if (request.status !== 'PENDING') {
      throw new BadRequestError('Yêu cầu này đã được xử lý');
    }

    const submission = await prisma.submission.findUnique({
      where: { id: request.submissionId },
      include: { group: { select: { classId: true, members: { include: { student: { select: { userId: true } } } } } } },
    });
    if (!submission) throw new NotFoundError('Không tìm thấy bài báo cáo');
    if (submission.group?.classId) {
      await academicService.verifyTermActive(submission.group.classId);
    }

    const oldStatus = submission.status;

    await prisma.$transaction(async (tx: any) => {
      // 1. Đánh dấu request APPROVED.
      await tx.gradeAppealRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedById: academicUserId,
          reviewNote: reviewNote?.trim() || 'PĐT đồng ý phúc khảo',
          reviewedAt: new Date(),
        },
      });

      // 2. Đẩy submission về DANG_CHAM với OCC.
      const upd = await tx.submission.updateMany({
        where: { id: request.submissionId, version: submission.version },
        data: { status: SubmissionStatus.DANG_CHAM, version: { increment: 1 } },
      });
      if (upd.count === 0) {
        throw new BadRequestError('Xung đột dữ liệu — vui lòng tải lại trang');
      }

      // 4. Log.
      await tx.submissionLog.create({
        data: {
          submissionId: request.submissionId,
          oldStatus,
          newStatus: SubmissionStatus.DANG_CHAM,
          actorId: academicUserId,
          note: `PĐT duyệt phúc khảo: ${reviewNote?.trim() ?? ''}`.trim(),
        },
      });
    });

    // 5. Notify SV gửi đơn + tất cả GV phụ trách lớp.
    try {
      const stu = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { userId: true },
      });
      if (stu?.userId) {
        await notificationService.createNotification({
          userId: stu.userId,
          title: 'Yêu cầu phúc khảo được duyệt',
          content: 'PĐT đã đồng ý phúc khảo. Bài báo cáo sẽ được chấm lại.',
          type: 'HE_THONG',
          submissionId: request.submissionId,
        });
      }

      if (submission.group?.classId) {
        const assigns = await prisma.assignment.findMany({
          where: { classId: submission.group.classId },
          include: { teacher: { select: { userId: true } } },
        });
        for (const a of assigns) {
          if (!a.teacher?.userId) continue;
          await notificationService.createNotification({
            userId: a.teacher.userId,
            title: 'Có bài cần chấm lại do phúc khảo',
            content: 'PĐT đã duyệt phúc khảo của sinh viên. Vui lòng chấm lại bài.',
            type: 'HE_THONG',
            submissionId: request.submissionId,
          });
        }
      }
    } catch {
      // best-effort
    }

    return { message: 'Đã duyệt phúc khảo, bài đã chuyển về Đang chấm.' };
  }

  async rejectAppeal(requestId: string, academicUserId: string, reviewNote: string) {
    if (!reviewNote || reviewNote.trim().length < 5) {
      throw new BadRequestError('Vui lòng nhập lý do từ chối (ít nhất 5 ký tự)');
    }
    const request = await (prisma as any).gradeAppealRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundError('Không tìm thấy yêu cầu phúc khảo');
    if (request.status !== 'PENDING') {
      throw new BadRequestError('Yêu cầu này đã được xử lý');
    }

    await (prisma as any).gradeAppealRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: academicUserId,
        reviewNote: reviewNote.trim(),
        reviewedAt: new Date(),
      },
    });

    try {
      const stu = await prisma.student.findUnique({
        where: { id: request.studentId },
        select: { userId: true },
      });
      if (stu?.userId) {
        await notificationService.createNotification({
          userId: stu.userId,
          title: 'Yêu cầu phúc khảo bị từ chối',
          content: `Lý do: ${reviewNote.trim()}`,
          type: 'HE_THONG',
          submissionId: request.submissionId,
        });
      }
    } catch {
      // best-effort
    }

    return { message: 'Đã từ chối phúc khảo.' };
  }
}

export const gradeAppealService = new GradeAppealService();
