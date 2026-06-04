import { reopenRequestRepository } from '../repositories/reopen-request.repository';
import { submissionRepository } from '../repositories/submission.repository';
import { notificationService } from './notification.service';
import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/apiResponse';
import { GradingReopenRequestStatus, SubmissionStatus, UserRole } from '@prisma/client';
import { academicService } from './academic.service';

export class ReopenRequestService {
  async createRequest(
    teacherId: string,
    submissionId: string,
    reason: string,
    teacherName: string
  ) {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestError('Lý do phải có ít nhất 10 ký tự');
    }

    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài báo cáo');
    }

    // Check ownership
    let isOwner = false;
    if (submission.group?.classId) {
      const assignment = await prisma.assignment.findFirst({
        where: { classId: submission.group.classId, teacherId }
      });
      if (assignment) isOwner = true;
    }
    if (!isOwner) {
      throw new ForbiddenError('Bạn không phải giảng viên phụ trách bài báo cáo này');
    }

    // Check status DA_CHAM or CHO_DUYET
    if (submission.status !== SubmissionStatus.DA_CHAM && submission.status !== 'CHO_DUYET') {
      throw new BadRequestError('Chỉ được yêu cầu mở lại khi báo cáo ở trạng thái Đã chấm hoặc Chờ duyệt');
    }

    // Check class is not locked
    if (submission.group?.classId) {
      await academicService.verifyTermActive(submission.group.classId);
    }

    // Check pending request
    const pending = await reopenRequestRepository.findPendingRequest(submissionId);
    if (pending) {
      throw new BadRequestError('Báo cáo này đang có yêu cầu mở lại chờ duyệt');
    }

    // Create
    const request = await reopenRequestRepository.createRequest(teacherId, submissionId, reason);

    // Notify all PDT & ADMIN
    const pdtUsers = await prisma.user.findMany({
      where: { role: { in: [UserRole.ACADEMIC_DEPT, UserRole.ADMIN] }, isActive: true },
      select: { id: true }
    });

    const topicName = submission.group?.topicName || 'Chưa có đề tài';
    const classCode = submission.group?.class?.classCode || '';

    for (const pdt of pdtUsers) {
      await notificationService.createNotification({
        userId: pdt.id,
        title: 'Yêu cầu mở lại chấm điểm mới',
        content: `Giảng viên ${teacherName} đã gửi yêu cầu mở lại chấm điểm cho báo cáo đề tài "${topicName}" - lớp ${classCode}.`,
        type: 'HE_THONG',
        submissionId
      });
    }

    return request;
  }

  async getRequests(filters: any) {
    return await reopenRequestRepository.findRequests(filters);
  }

  async approveRequest(requestId: string, academicUserId: string, reviewNote?: string) {
    const request = await reopenRequestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Không tìm thấy yêu cầu');
    }
    if (request.status !== GradingReopenRequestStatus.PENDING) {
      throw new BadRequestError('Yêu cầu không ở trạng thái chờ duyệt');
    }

    const submission = await submissionRepository.findSubmissionById(request.submissionId);
    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài báo cáo');
    }
    if (submission.status === SubmissionStatus.HOAN_THANH) {
      throw new BadRequestError('Báo cáo đã hoàn thành, không thể mở lại');
    }
    if (submission.group?.classId) {
      await academicService.verifyTermActive(submission.group.classId);
    }

    // Process
    await prisma.$transaction(async (tx) => {
      // 1. Update Request
      await tx.gradingReopenRequest.update({
        where: { id: requestId },
        data: {
          status: GradingReopenRequestStatus.APPROVED,
          reviewedById: academicUserId,
          reviewNote: reviewNote || 'Đồng ý mở lại',
          reviewedAt: new Date(),
        }
      });

      // 2. Update Submission Status with OCC
      const updateResult = await tx.submission.updateMany({
        where: { id: request.submissionId, version: submission.version },
        data: {
          status: SubmissionStatus.DANG_CHAM,
          version: { increment: 1 }
        }
      });

      if (updateResult.count === 0) {
        throw new BadRequestError('Xung đột dữ liệu báo cáo, vui lòng thử lại');
      }

      // 3. Log
      await tx.submissionLog.create({
        data: {
          submissionId: request.submissionId,
          oldStatus: submission.status,
          newStatus: SubmissionStatus.DANG_CHAM,
          actorId: academicUserId,
          note: `Duyệt yêu cầu mở lại chấm điểm từ Phòng Đào tạo`,
        }
      });
    });

    // 4. Notify teacher
    const teacherUser = await prisma.user.findFirst({
      where: { teacher: { id: request.teacherId } }
    });
    if (teacherUser) {
      await notificationService.createNotification({
        userId: teacherUser.id,
        title: 'Yêu cầu mở lại chấm điểm được duyệt',
        content: `Yêu cầu mở lại chấm điểm của bạn đã được duyệt. Báo cáo đã chuyển về trạng thái Đang chấm.`,
        type: 'HE_THONG',
        submissionId: request.submissionId
      });
    }

    return { message: 'Đã duyệt yêu cầu mở lại chấm điểm' };
  }

  async rejectRequest(requestId: string, academicUserId: string, reviewNote: string) {
    if (!reviewNote || reviewNote.trim() === '') {
      throw new BadRequestError('Vui lòng nhập lý do từ chối');
    }

    const request = await reopenRequestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError('Không tìm thấy yêu cầu');
    }
    if (request.status !== GradingReopenRequestStatus.PENDING) {
      throw new BadRequestError('Yêu cầu không ở trạng thái chờ duyệt');
    }

    await reopenRequestRepository.updateRequest(
      requestId,
      GradingReopenRequestStatus.REJECTED,
      academicUserId,
      reviewNote
    );

    // Notify teacher
    const teacherUser = await prisma.user.findFirst({
      where: { teacher: { id: request.teacherId } }
    });
    if (teacherUser) {
      await notificationService.createNotification({
        userId: teacherUser.id,
        title: 'Yêu cầu mở lại chấm điểm bị từ chối',
        content: `Yêu cầu mở lại chấm điểm của bạn đã bị từ chối. Lý do: ${reviewNote}`,
        type: 'HE_THONG',
        submissionId: request.submissionId
      });
    }

    return { message: 'Đã từ chối yêu cầu mở lại chấm điểm' };
  }
}

export const reopenRequestService = new ReopenRequestService();
