import { submissionRepository } from '../repositories/submission.repository';
import { academicService } from './academic.service';
import { notificationService } from './notification.service';
import { studentNotificationService } from './student-notification.service';
import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { Submission, SubmissionStatus } from '@prisma/client';

export class SubmissionService {
  /**
   * Sinh viên nộp bài báo cáo mới hoặc nộp đè bài cũ (Cá nhân hoặc Nhóm)
   */
  async submitReport(
    studentId: string,
    data: { filePath: string; attachments: string[]; classId: string }
  ): Promise<Submission> {
    // 1. Kiểm tra tồn tại thông tin sinh viên
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: true,
        groupMemberships: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundError("Không tìm thấy thông tin tài khoản sinh viên");
    }

    // 2. Chốt chặn học kỳ
    await academicService.verifyTermActive(data.classId);

    // 3. Kiểm duyệt SV đã enroll lớp học phần này
    const isEnrolled = student.enrollments.some(e => e.classId === data.classId);
    if (!isEnrolled) {
      throw new BadRequestError("Sinh viên không đăng ký lớp học phần này");
    }

    // 4. Tìm nhóm của SV trong LHP cụ thể qua GroupMember
    const groupMembership = student.groupMemberships.find(gm => gm.group.classId === data.classId);
    const groupId = groupMembership?.groupId || null;

    // 5. Nếu SV có nhóm nhưng nhóm chưa có đề tài → chặn nộp bài
    if (groupMembership && !groupMembership.group.topicName) {
      throw new BadRequestError("Nhóm chưa được giao đề tài. Không thể nộp bài!");
    }

    // 6. Tìm kiếm bài nộp hiện tại của Sinh viên (hoặc nhóm đề tài của sinh viên) trong lớp
    const existingSubmission = await submissionRepository.findStudentSubmissionInClass(studentId, groupId);

    if (existingSubmission) {
      // Nếu đã có bài nộp, tiến hành nộp đè bài mới (resubmit)
      if (existingSubmission.status === SubmissionStatus.DA_CHAM || existingSubmission.status === SubmissionStatus.HOAN_THANH) {
        throw new BadRequestError("Bài báo cáo môn học đã được giảng viên chấm điểm hoàn thành. Bạn không thể nộp đè!");
      }

      const result = await submissionRepository.resubmitReport(
        existingSubmission.id,
        existingSubmission.version,
        { filePath: data.filePath, attachments: data.attachments },
        studentId
      );
      await studentNotificationService.notifySubmissionSuccess(result.id, true);
      return result;
    } else {
      // Nếu chưa có bài nộp, tiến hành tạo mới
      const submissionData = {
        filePath: data.filePath,
        attachments: data.attachments,
        status: SubmissionStatus.DA_NOP,
        studentId: groupId ? null : studentId, // Nộp cá nhân
        groupId: groupId ? groupId : null, // Nộp theo Nhóm
      };

      const result = await submissionRepository.createSubmission(submissionData, studentId);
      await studentNotificationService.notifySubmissionSuccess(result.id, false);
      return result;
    }
  }

  /**
   * Giảng viên hoặc PDT thay đổi trạng thái bài nộp (duyệt/yêu cầu sửa/từ chối) kèm OCC
   */
  async updateStatus(
    id: string,
    currentVersion: number,
    data: {
      status: SubmissionStatus;
      note?: string;
      rejectReason?: string;
      editRequestNote?: string;
    },
    actorId: string,
    reqUserFullName: string
  ): Promise<Submission> {
    const submission = await submissionRepository.findSubmissionById(id);
    if (!submission) {
      throw new NotFoundError("Không tìm thấy thông tin bài nộp để cập nhật");
    }

    // Xác minh niên khóa tương ứng còn hoạt động — dùng group.classId hoặc tìm qua enrollment
    const classId = submission.group?.classId || null;
    if (classId) {
      await academicService.verifyTermActive(classId);
    }

    // Chặn giảng viên tự ý chuyển từ DA_CHAM/CHO_DUYET về DANG_CHAM
    if (data.status === SubmissionStatus.DANG_CHAM) {
      if (submission.status === SubmissionStatus.DA_CHAM || submission.status === 'CHO_DUYET') {
        throw new BadRequestError("Không được phép tự ý chuyển trạng thái báo cáo về Đang chấm. Vui lòng gửi yêu cầu mở lại chấm điểm.");
      }
    }

    // Tiến hành cập nhật trạng thái kèm chốt chặn OCC
    const result = await submissionRepository.updateSubmissionStatusWithOCC(
      id,
      currentVersion,
      {
        status: data.status,
        note: data.note,
        rejectReason: data.rejectReason,
        editRequestNote: data.editRequestNote,
      },
      actorId
    );

    // Gửi thông báo cho sinh viên về thay đổi trạng thái
    const userIds: string[] = [];
    if (submission.student?.userId) {
      userIds.push(submission.student.userId);
    } else if (submission.group?.members) {
      submission.group.members.forEach((m: any) => {
        if (m.student?.userId) userIds.push(m.student.userId);
      });
    }

    if (data.status === SubmissionStatus.YEU_CAU_SUA) {
      await studentNotificationService.notifyRevisionRequested(id, reqUserFullName, data.editRequestNote || 'Vui lòng kiểm tra lại báo cáo.');
    } else if (data.status === SubmissionStatus.TU_CHOI) {
      await studentNotificationService.notifySubmissionRejected(id, data.rejectReason || 'Báo cáo không đạt yêu cầu.');
    } else if (data.status === SubmissionStatus.HOAN_THANH) {
      await studentNotificationService.notifyResultPublished(id);
    } else {
      for (const uid of userIds) {
        await notificationService.notifyStatusChange(uid, id, data.status, reqUserFullName);
      }
    }

    // Nếu có rejectReason chứa thông tin CHO_KIEM_TRA, gửi thêm thông báo cho giảng viên phụ trách
    if (data.rejectReason && (data.rejectReason.includes('"type":"CHO_KIEM_TRA"') || data.rejectReason.includes('"status":"CHO_KIEM_TRA"'))) {
      try {
        const clsId = submission.group?.classId;
        if (clsId) {
          const assignment = await prisma.assignment.findFirst({
            where: { classId: clsId },
            include: {
              teacher: true,
            },
          });
          const teacherUserId = assignment?.teacher?.userId;
          if (teacherUserId) {
            let parsedLog: any = {};
            try {
              parsedLog = JSON.parse(data.rejectReason);
            } catch (e) {}
            
            await notificationService.createNotification({
              userId: teacherUserId,
              title: 'Cảnh báo vi phạm báo cáo mới',
              content: `Admin đã gắn cảnh báo vi phạm [${parsedLog.warningType || parsedLog.violationType || 'Quy chế'}] cho báo cáo ${id}. Lý do: ${parsedLog.reason || ''}. Vui lòng kiểm tra lại.`,
              type: 'TRANG_THAI',
              submissionId: id,
            });
          }
        }
      } catch (err) {
        console.error('Không thể gửi thông báo cho giảng viên phụ trách:', err);
      }
    }

    return result;
  }

  /**
   * Lấy bài nộp hiện tại của Sinh viên (hoặc nhóm của sinh viên)
   */
  async getStudentSubmission(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        groupMemberships: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundError("Không tìm thấy thông tin tài khoản sinh viên");
    }

    // Lấy groupId đầu tiên (nếu có) — backwards compat: SV có thể ở nhiều LHP nhưng submission flow cần classId
    const groupId = student.groupMemberships.length > 0 ? student.groupMemberships[0].groupId : null;

    const submission = await submissionRepository.findStudentSubmissionInClass(student.id, groupId);
    if (!submission) {
      return null;
    }

    return await submissionRepository.findSubmissionById(submission.id);
  }

  /**
   * Xem chi tiết bài nộp
   */
  async getSubmissionById(id: string) {
    const submission = await submissionRepository.findSubmissionById(id);
    if (!submission) {
      throw new NotFoundError("Không tìm thấy chi tiết bài nộp yêu cầu");
    }
    return submission;
  }

  /**
   * Xem toàn bộ bài nộp của lớp học phần
   */
  async getSubmissionsByClassId(classId: string) {
    await academicService.getClassById(classId); // Check lớp tồn tại
    return await submissionRepository.findSubmissionsByClassId(classId);
  }

  /**
   * Xem toàn bộ bài nộp báo cáo của hệ thống (PDT/Admin)
   */
  async getAllSubmissions() {
    return await submissionRepository.findAllSubmissions();
  }
}

export const submissionService = new SubmissionService();
