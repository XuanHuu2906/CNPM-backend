import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { notificationService } from './notification.service';
import { SubmissionStatus } from '@prisma/client';

export class ResubmissionRequestService {
  /**
   * Sinh viên gửi yêu cầu xin nộp lại
   */
  async createRequest(studentId: string, submissionId: string, reason: string) {
    // Kiểm tra xem bài nộp có tồn tại và có thuộc về sinh viên này không
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: true,
        group: {
          include: { members: { include: { student: true } } }
        }
      }
    });

    if (!submission) {
      throw new NotFoundError("Không tìm thấy bài nộp.");
    }

    // Kiểm tra quyền (cá nhân hoặc nhóm)
    const isOwner = submission.studentId === studentId || submission.group?.members.some((m: any) => m.studentId === studentId);
    if (!isOwner) {
      throw new BadRequestError("Bạn không có quyền thao tác trên bài nộp này.");
    }

    // Kiểm tra trạng thái bài nộp phải là DA_NOP
    if (submission.status !== SubmissionStatus.DA_NOP) {
      throw new BadRequestError("Chỉ có thể gửi yêu cầu nộp lại khi trạng thái là ĐÃ NỘP.");
    }

    // Kiểm tra xem có yêu cầu nào đang chờ xử lý không
    const existingPending = await prisma.resubmissionRequest.findFirst({
      where: {
        submissionId: submissionId,
        status: 'CHO_XU_LY'
      }
    });

    if (existingPending) {
      throw new BadRequestError("Bạn đang có một yêu cầu chờ xử lý cho bài nộp này.");
    }

    // Tạo yêu cầu mới
    const request = await prisma.resubmissionRequest.create({
      data: {
        submissionId,
        studentId,
        reason,
        status: 'CHO_XU_LY'
      }
    });

    // Gửi notification cho GV phụ trách lớp (best-effort)
    try {
      // Xác định classId qua group (bài nhóm) hoặc enrollment (bài cá nhân)
      let classId: string | null = submission.group?.classId ?? null;
      if (!classId && submission.studentId) {
        const enrollment = await prisma.classEnrollment.findFirst({
          where: { studentId: submission.studentId },
          orderBy: { createdAt: 'desc' },
          select: { classId: true },
        });
        classId = enrollment?.classId ?? null;
      }
      if (classId) {
        const studentInfo = await prisma.student.findUnique({
          where: { id: studentId },
          include: { user: { select: { fullName: true } } },
        });
        const studentName = studentInfo?.user?.fullName ?? 'Sinh viên';
        const assignments = await prisma.assignment.findMany({
          where: { classId },
          include: { teacher: { select: { userId: true } } },
        });
        for (const a of assignments) {
          const teacherUserId = a.teacher?.userId;
          if (!teacherUserId) continue;
          await notificationService.createNotification({
            userId: teacherUserId,
            title: 'Yêu cầu nộp lại từ sinh viên',
            content: `${studentName} đã gửi yêu cầu nộp lại báo cáo. Lý do: ${reason}`,
            type: 'YEU_CAU_SUA',
            submissionId,
          });
        }
      }
    } catch (err) {
      console.error('Không thể gửi thông báo cho giảng viên khi SV yêu cầu nộp lại:', err);
    }

    return request;
  }

  /**
   * Lấy danh sách yêu cầu nộp lại của một sinh viên
   */
  async getStudentRequests(studentId: string) {
    return await prisma.resubmissionRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        submission: true,
        reviewer: {
          select: { user: { select: { fullName: true } } }
        }
      }
    });
  }

  /**
   * Lấy danh sách yêu cầu nộp lại dành cho giảng viên (những bài nộp thuộc lớp mà giảng viên này phụ trách)
   */
  async getTeacherPendingRequests(teacherId: string) {
    // Tìm các assignment của giảng viên
    const assignments = await prisma.assignment.findMany({
      where: { teacherId },
      select: { classId: true }
    });
    
    const classIds = assignments.map(a => a.classId);

    // Lấy các yêu cầu thuộc về sinh viên/nhóm trong các class này, và trạng thái là CHO_XU_LY
    return await prisma.resubmissionRequest.findMany({
      where: {
        status: 'CHO_XU_LY',
        submission: {
          OR: [
            {
              student: {
                enrollments: { some: { classId: { in: classIds } } },
              },
            },
            { group: { classId: { in: classIds } } }
          ]
        }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        student: {
          select: {
            studentCode: true,
            user: { select: { fullName: true } }
          }
        },
        submission: {
          select: {
            id: true,
            version: true,
            status: true,
            filePath: true,
            attachments: true
          }
        }
      }
    });
  }

  /**
   * Giảng viên duyệt yêu cầu
   */
  async approveRequest(requestId: string, teacherId: string, feedbackNote?: string) {
    const request = await prisma.resubmissionRequest.findUnique({
      where: { id: requestId },
      include: { submission: true }
    });

    if (!request) throw new NotFoundError("Không tìm thấy yêu cầu.");
    if (request.status !== 'CHO_XU_LY') throw new BadRequestError("Yêu cầu này đã được xử lý.");

    // Dùng transaction để đảm bảo tính nhất quán
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái yêu cầu
      const updatedReq = await tx.resubmissionRequest.update({
        where: { id: requestId },
        data: {
          status: 'DA_DUYET',
          reviewerId: teacherId,
          feedbackNote: feedbackNote || null
        }
      });

      // 2. Cập nhật trạng thái bài nộp về YEU_CAU_SUA
      await tx.submission.update({
        where: { id: request.submissionId },
        data: {
          status: SubmissionStatus.YEU_CAU_SUA,
          editRequestNote: feedbackNote || "Giảng viên đã đồng ý cho phép nộp lại."
        }
      });

      // 3. Ghi log lịch sử trạng thái bài nộp
      await tx.submissionLog.create({
        data: {
          submissionId: request.submissionId,
          oldStatus: request.submission.status,
          newStatus: SubmissionStatus.YEU_CAU_SUA,
          actorId: teacherId,
          note: "Chấp nhận yêu cầu nộp lại từ sinh viên."
        }
      });

      return updatedReq;
    });

    // Gửi thông báo cho sinh viên
    const studentInfo = await prisma.student.findUnique({ where: { id: request.studentId } });
    if (studentInfo) {
      await notificationService.notifyStatusChange(
        studentInfo.userId, 
        request.submissionId, 
        SubmissionStatus.YEU_CAU_SUA, 
        "Giảng viên"
      );
    }

    return result;
  }

  /**
   * Giảng viên từ chối yêu cầu
   */
  async rejectRequest(requestId: string, teacherId: string, feedbackNote: string) {
    const request = await prisma.resubmissionRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) throw new NotFoundError("Không tìm thấy yêu cầu.");
    if (request.status !== 'CHO_XU_LY') throw new BadRequestError("Yêu cầu này đã được xử lý.");

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái yêu cầu
      const updatedReq = await tx.resubmissionRequest.update({
        where: { id: requestId },
        data: {
          status: 'TU_CHOI',
          reviewerId: teacherId,
          feedbackNote: feedbackNote
        }
      });
      return updatedReq;
    });

    // Thông báo cho sinh viên về việc bị từ chối
    const studentInfo = await prisma.student.findUnique({ where: { id: request.studentId } });
    if (studentInfo) {
      await notificationService.createNotification({
        userId: studentInfo.userId,
        title: "Yêu cầu nộp lại bị từ chối",
        content: `Yêu cầu nộp lại báo cáo của bạn đã bị từ chối. Lý do: ${feedbackNote}`,
        type: "YEU_CAU_SUA",
        submissionId: request.submissionId
      });
    }

    return result;
  }
}

export const resubmissionRequestService = new ResubmissionRequestService();
