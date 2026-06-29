import { submissionRepository } from '../repositories/submission.repository';
import { academicService } from './academic.service';
import { notificationService } from './notification.service';
import { studentNotificationService } from './student-notification.service';
import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { verifyTeacherClassOwnership } from '../utils/ownership';
import { Submission, SubmissionStatus, UserRole } from '@prisma/client';

export class SubmissionService {
  /**
   * Sinh viên nộp bài báo cáo mới hoặc nộp đè bài cũ (Cá nhân hoặc Nhóm)
   */
  async submitReport(
    studentId: string,
    data: { filePath: string; attachments: string[]; classId: string; repoLink?: string; videoLink?: string }
  ): Promise<Submission> {
    // 1. Kiểm tra tồn tại thông tin sinh viên
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { fullName: true } },
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
      // R3: SV không tự nộp đè. Chỉ cho phép resubmit khi:
      //  - Bài đang ở trạng thái YEU_CAU_SUA (GV đã yêu cầu sửa), HOẶC
      //  - Có ResubmissionRequest đã được duyệt (DA_DUYET) cho bài này.
      const isEditRequested = existingSubmission.status === SubmissionStatus.YEU_CAU_SUA;

      let hasApprovedResubmitRequest = false;
      if (!isEditRequested) {
        const approvedRequest = await prisma.resubmissionRequest.findFirst({
          where: {
            submissionId: existingSubmission.id,
            studentId,
            status: 'DA_DUYET',
          },
        });
        hasApprovedResubmitRequest = !!approvedRequest;
      }

      if (!isEditRequested && !hasApprovedResubmitRequest) {
        throw new BadRequestError(
          "Bạn đã nộp bài. Vui lòng gửi 'Yêu cầu nộp lại' và chờ Giảng viên duyệt trước khi nộp đè."
        );
      }

      const result = await submissionRepository.resubmitReport(
        existingSubmission.id,
        existingSubmission.version,
        {
          filePath: data.filePath,
          attachments: data.attachments,
          repoLink: data.repoLink?.trim() || null,
          videoLink: data.videoLink?.trim() || null,
        },
        studentId
      );
      await studentNotificationService.notifySubmissionSuccess(result.id, true);
      await this.notifyClassTeachersOnSubmit(data.classId, student.user?.fullName ?? 'Sinh viên', result.id, true);
      return result;
    } else {
      // Nếu chưa có bài nộp, tiến hành tạo mới
      // B17: luôn lưu studentId (kể cả khi có group) để ghi nhận người nộp; groupId xác định bài nhóm.
      const submissionData = {
        filePath: data.filePath,
        attachments: data.attachments,
        status: SubmissionStatus.DA_NOP,
        studentId,
        groupId: groupId ? groupId : null,
        repoLink: data.repoLink?.trim() || null,
        videoLink: data.videoLink?.trim() || null,
      };

      const result = await submissionRepository.createSubmission(submissionData, studentId);
      await studentNotificationService.notifySubmissionSuccess(result.id, false);
      await this.notifyClassTeachersOnSubmit(data.classId, student.user?.fullName ?? 'Sinh viên', result.id, false);
      return result;
    }
  }

  /**
   * Gửi notification cho TẤT CẢ GV phụ trách lớp khi SV nộp / nộp lại báo cáo.
   * Best-effort: lỗi gửi không làm fail nghiệp vụ nộp bài.
   */
  private async notifyClassTeachersOnSubmit(classId: string, studentName: string, submissionId: string, isResubmit: boolean) {
    try {
      const assignments = await prisma.assignment.findMany({
        where: { classId },
        include: { teacher: { select: { userId: true } } },
      });
      const verb = isResubmit ? 'nộp lại' : 'nộp';
      for (const a of assignments) {
        const teacherUserId = a.teacher?.userId;
        if (!teacherUserId) continue;
        await notificationService.createNotification({
          userId: teacherUserId,
          title: `Sinh viên ${verb} báo cáo mới`,
          content: `${studentName} đã ${verb} báo cáo. Vui lòng vào hàng đợi chấm điểm để xem.`,
          type: 'TRANG_THAI',
          submissionId,
        });
      }
    } catch (err) {
      console.error('Không thể gửi thông báo cho giảng viên khi SV nộp bài:', err);
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
      // B13: phân loại vi phạm — thay vì nhét JSON vào rejectReason.
      violationType?: string;
      editRequestNote?: string;
    },
    actorId: string,
    reqUserFullName: string,
    actorRole?: UserRole
  ): Promise<Submission> {
    const submission = await submissionRepository.findSubmissionById(id);
    if (!submission) {
      throw new NotFoundError("Không tìm thấy thông tin bài nộp để cập nhật");
    }

    // B8: Khi SV nộp cá nhân (không có group), lookup classId qua Enrollment để vẫn chốt được học kỳ
    let classId: string | null = submission.group?.classId || null;
    if (!classId && submission.studentId) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { studentId: submission.studentId },
        orderBy: { createdAt: 'desc' },
        select: { classId: true },
      });
      classId = enrollment?.classId ?? null;
    }

    if (classId) {
      await academicService.verifyTermActive(classId);
    } else {
      throw new BadRequestError('Không xác định được lớp học phần của bài nộp này.');
    }

    // B4: GV chỉ được duyệt/từ chối bài nộp thuộc lớp mình phụ trách
    if (actorRole === UserRole.TEACHER) {
      await verifyTeacherClassOwnership(classId, actorId);
    }

    // Chặn giảng viên tự ý chuyển từ DA_CHAM/CHO_DUYET về DANG_CHAM
    if (data.status === SubmissionStatus.DANG_CHAM) {
      if (submission.status === SubmissionStatus.DA_CHAM || submission.status === SubmissionStatus.CHO_DUYET) {
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
        violationType: data.violationType,
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

    // B13: phân loại vi phạm đã lưu vào field violationType. Backward-compat: vẫn nhận
    // diện được payload cũ kiểu '{"type":"CHO_KIEM_TRA",...}' nhúng trong rejectReason.
    const violationType = data.violationType
      ?? (data.rejectReason && (data.rejectReason.includes('"type":"CHO_KIEM_TRA"') || data.rejectReason.includes('"status":"CHO_KIEM_TRA"'))
            ? 'CHO_KIEM_TRA'
            : undefined);

    if (violationType === 'CHO_KIEM_TRA') {
      try {
        const clsId = submission.group?.classId;
        if (clsId) {
          const assignment = await prisma.assignment.findFirst({
            where: { classId: clsId },
            include: { teacher: true },
          });
          const teacherUserId = assignment?.teacher?.userId;
          if (teacherUserId) {
            await notificationService.createNotification({
              userId: teacherUserId,
              title: 'Cảnh báo vi phạm báo cáo mới',
              content: `Admin đã gắn cảnh báo vi phạm [${violationType}] cho báo cáo ${id}. Lý do: ${data.rejectReason || ''}. Vui lòng kiểm tra lại.`,
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
   * Lấy bài nộp hiện tại của Sinh viên trong một LHP cụ thể (UC-10/UC-18/UC-22).
   * B9: Bắt buộc nhận classId để xác định chính xác bài thuộc lớp nào (SV có thể đăng ký nhiều LHP).
   * Backwards-compat: nếu không truyền classId, fallback theo group đầu tiên (cảnh báo deprecated).
   */
  async getStudentSubmission(studentId: string, classId?: string) {
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

    let groupId: string | null = null;
    if (classId) {
      // Tìm group của SV trong đúng LHP được yêu cầu
      const membership = student.groupMemberships.find((gm) => gm.group.classId === classId);
      groupId = membership?.groupId ?? null;
    } else if (student.groupMemberships.length > 0) {
      // Backwards-compat fallback
      groupId = student.groupMemberships[0].groupId;
    }

    const submission = classId
      ? await submissionRepository.findStudentSubmissionInClassByClassId(student.id, groupId, classId)
      : await submissionRepository.findStudentSubmissionInClass(student.id, groupId);

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
