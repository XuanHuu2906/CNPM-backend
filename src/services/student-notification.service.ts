import { notificationService } from './notification.service';
import { emailService } from './email.service';
import { prisma } from '../config/prisma';
import { SubmissionStatus } from '@prisma/client';

export class StudentNotificationService {
  /**
   * Helper để lấy email của sinh viên từ studentId
   */
  private async getStudentUser(studentId: string) {
    return await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true }
    });
  }

  /**
   * Lấy danh sách users từ bài nộp (có thể cá nhân hoặc nhóm)
   */
  private async getSubmissionUsers(submissionId: string) {
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: { include: { user: true } },
        group: {
          include: {
            members: {
              include: { student: { include: { user: true } } }
            }
          }
        }
      }
    });

    if (!sub) return { users: [], topic: 'N/A' };
    
    const topic = sub.group ? sub.group.topicName : (sub.studentId ? 'Báo cáo cá nhân' : 'N/A');

    if (sub.groupId && sub.group) {
      return { 
        users: sub.group.members.map((m: any) => m.student.user),
        topic
      };
    } else if (sub.studentId && sub.student) {
      return { 
        users: [sub.student.user],
        topic
      };
    }
    return { users: [], topic };
  }

  // 1. Tài khoản được tạo (chỉ gửi Email)
  async notifyAccountCreated(userId: string, email: string, fullName: string) {
    // Thông báo in-app
    await notificationService.createNotification({
      userId,
      title: 'Chào mừng bạn',
      content: 'Tài khoản của bạn đã được tạo thành công.',
      type: 'HE_THONG'
    });

    // Email
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    const html = `
      <h2>Chào mừng ${fullName}</h2>
      <p>Tài khoản sinh viên của bạn trên Hệ thống Chấm điểm Báo cáo đã được tạo thành công.</p>
      <p>Vui lòng đăng nhập và thay đổi mật khẩu trong lần đầu tiên để bảo mật tài khoản.</p>
      <a href="${loginUrl}" style="padding:10px 20px; background:#4F46E5; color:#fff; text-decoration:none; border-radius:5px;">Đăng nhập hệ thống</a>
    `;
    await emailService.sendEmail(email, 'Thông tin tài khoản sinh viên', html, 'STUDENT_ACCOUNT_CREATED');
  }

  // 2. Nộp báo cáo thành công
  async notifySubmissionSuccess(submissionId: string, isResubmission: boolean) {
    const { users, topic } = await this.getSubmissionUsers(submissionId);
    
    for (const user of users) {
      // In-app
      await notificationService.createNotification({
        userId: user.id,
        title: isResubmission ? 'Nộp lại báo cáo thành công' : 'Nộp báo cáo thành công',
        content: `Báo cáo cho đề tài "${topic}" đã được hệ thống ghi nhận.`,
        type: 'TRANG_THAI',
        submissionId
      });

      // Email
      const html = `
        <h2>Xác nhận nộp báo cáo</h2>
        <p>Xin chào ${user.fullName},</p>
        <p>Hệ thống đã ghi nhận ${isResubmission ? 'bản nộp lại' : 'bài nộp'} báo cáo của bạn/nhóm bạn.</p>
        <ul>
          <li><strong>Đề tài:</strong> ${topic}</li>
          <li><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</li>
        </ul>
        <p>Bạn có thể đăng nhập hệ thống để theo dõi trạng thái chấm điểm.</p>
      `;
      const type = isResubmission ? 'RESUBMISSION_SUCCESS' : 'SUBMISSION_SUCCESS';
      // dedupeKey: SUBMISSION_SUCCESS:submissionId:userId
      const dedupeKey = `${type}:${submissionId}:${user.id}`;
      await emailService.sendEmail(user.email, 'Xác nhận nộp báo cáo thành công', html, type, dedupeKey);
    }
  }

  // 3. Yêu cầu sửa báo cáo
  async notifyRevisionRequested(submissionId: string, teacherName: string, reason: string) {
    const { users, topic } = await this.getSubmissionUsers(submissionId);
    
    for (const user of users) {
      // In-app
      await notificationService.notifyEditRequest(user.id, submissionId, teacherName);

      // Email
      const html = `
        <h2>Yêu cầu chỉnh sửa báo cáo</h2>
        <p>Xin chào ${user.fullName},</p>
        <p>Giảng viên <strong>${teacherName}</strong> đã gửi yêu cầu chỉnh sửa báo cáo cho đề tài của bạn/nhóm bạn.</p>
        <ul>
          <li><strong>Đề tài:</strong> ${topic}</li>
          <li><strong>Yêu cầu từ giảng viên:</strong> ${reason}</li>
        </ul>
        <p>Vui lòng đăng nhập hệ thống để xem chi tiết và nộp lại báo cáo đúng hạn.</p>
      `;
      await emailService.sendEmail(user.email, 'Giảng viên yêu cầu chỉnh sửa báo cáo', html, 'SUBMISSION_REVISION_REQUESTED');
    }
  }

  // 4. Báo cáo bị từ chối
  async notifySubmissionRejected(submissionId: string, reason: string) {
    const { users, topic } = await this.getSubmissionUsers(submissionId);
    
    for (const user of users) {
      // In-app
      await notificationService.createNotification({
        userId: user.id,
        title: 'Báo cáo bị từ chối',
        content: `Báo cáo của bạn bị từ chối. Lý do: ${reason}`,
        type: 'TRANG_THAI',
        submissionId
      });

      // Email
      const html = `
        <h2>Báo cáo bị từ chối</h2>
        <p>Xin chào ${user.fullName},</p>
        <p>Báo cáo cho đề tài <strong>${topic}</strong> của bạn/nhóm bạn đã bị <strong>từ chối</strong>.</p>
        <p><strong>Lý do:</strong> ${reason}</p>
        <p>Vui lòng liên hệ giảng viên hướng dẫn hoặc phòng đào tạo để biết thêm chi tiết.</p>
      `;
      await emailService.sendEmail(user.email, 'Báo cáo bị từ chối', html, 'SUBMISSION_REJECTED');
    }
  }

  // 5. Kết quả được công bố
  async notifyResultPublished(submissionId: string) {
    const { users, topic } = await this.getSubmissionUsers(submissionId);
    
    for (const user of users) {
      // In-app
      await notificationService.createNotification({
        userId: user.id,
        title: 'Kết quả được công bố',
        content: `Kết quả báo cáo đề tài "${topic}" đã được Phòng Đào tạo phê duyệt và công bố.`,
        type: 'TRANG_THAI',
        submissionId
      });

      // Email (NO SCORES IN EMAIL)
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      const html = `
        <h2>Kết quả báo cáo đã được công bố</h2>
        <p>Xin chào ${user.fullName},</p>
        <p>Kết quả báo cáo đề tài <strong>${topic}</strong> của bạn/nhóm bạn đã được Phòng Đào tạo phê duyệt và công bố.</p>
        <p>Trạng thái: Hoàn thành</p>
        <p>Vui lòng đăng nhập hệ thống để xem điểm và nhận xét chi tiết.</p>
        <br/>
        <a href="${loginUrl}" style="padding:10px 20px; background:#4F46E5; color:#fff; text-decoration:none; border-radius:5px;">Xem kết quả</a>
      `;
      // dedupe: RESULT_PUBLISHED:submissionId:userId
      const dedupeKey = `RESULT_PUBLISHED:${submissionId}:${user.id}`;
      await emailService.sendEmail(user.email, 'Kết quả báo cáo đã được công bố', html, 'RESULT_PUBLISHED', dedupeKey);
    }
  }

  // 6. Nhắc nhở Deadline
  async remindDeadline(
    users: { id: string, email: string, fullName: string }[],
    topic: string,
    targetId: string, // groupId hoặc studentId:classId
    hoursRemaining: number
  ) {
    for (const user of users) {
      // In-app
      await notificationService.createNotification({
        userId: user.id,
        title: 'Nhắc nhở hạn nộp báo cáo',
        content: `Đề tài "${topic}" chỉ còn khoảng ${hoursRemaining} giờ nữa là đến hạn nộp. Vui lòng nộp báo cáo đúng hạn!`,
        type: 'DEADLINE',
      });

      // Email
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      const html = `
        <h2>Nhắc nhở hạn nộp báo cáo</h2>
        <p>Xin chào ${user.fullName},</p>
        <p>Hệ thống nhắc nhở bạn/nhóm bạn về hạn nộp báo cáo cho đề tài <strong>${topic}</strong>.</p>
        <p>Bạn chỉ còn khoảng <strong>${hoursRemaining} giờ</strong> nữa để nộp bài.</p>
        <p>Vui lòng đăng nhập và nộp báo cáo đúng hạn để tránh bị trừ điểm hoặc từ chối bài nộp.</p>
        <br/>
        <a href="${loginUrl}" style="padding:10px 20px; background:#4F46E5; color:#fff; text-decoration:none; border-radius:5px;">Nộp báo cáo ngay</a>
      `;
      
      const dedupeKey = `DEADLINE_REMINDER_${hoursRemaining}H:${targetId}:${user.id}`;
      await emailService.sendEmail(user.email, 'Nhắc nhở hạn nộp báo cáo sắp đến', html, 'SUBMISSION_DEADLINE_REMINDER', dedupeKey);
    }
  }
}

export const studentNotificationService = new StudentNotificationService();
