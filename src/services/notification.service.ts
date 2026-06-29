import { notificationRepository } from '../repositories/notification.repository';
import { SubmissionStatus } from '@prisma/client';

export class NotificationService {
  async createNotification(data: {
    userId: string;
    title: string;
    content: string;
    type: string;
    submissionId?: string;
  }) {
    return await notificationRepository.create(data);
  }

  async getNotifications(userId: string, page: number, limit: number) {
    return await notificationRepository.findByUserId(userId, page, limit);
  }

  async countUnread(userId: string) {
    return await notificationRepository.countUnread(userId);
  }

  async markAsRead(id: string, userId: string) {
    return await notificationRepository.markAsRead(id);
  }

  async markAllAsRead(userId: string) {
    return await notificationRepository.markAllAsRead(userId);
  }

  async notifyStatusChange(userId: string, submissionId: string, newStatus: string, actorName: string) {
    const statusLabels: Record<string, string> = {
      [SubmissionStatus.DA_NOP]: 'Đã nộp',
      [SubmissionStatus.DANG_CHAM]: 'Đang chấm',
      [SubmissionStatus.YEU_CAU_SUA]: 'Yêu cầu sửa',
      [SubmissionStatus.TU_CHOI]: 'Từ chối',
      [SubmissionStatus.DA_CHAM]: 'Đã chấm',
    };

    const statusLabel = statusLabels[newStatus] || newStatus;
    return await this.createNotification({
      userId,
      title: 'Cập nhật trạng thái bài nộp',
      content: `Bài nộp của bạn đã được chuyển sang trạng thái "${statusLabel}" bởi ${actorName}.`,
      type: 'TRANG_THAI',
      submissionId,
    });
  }

  async notifyEditRequest(userId: string, submissionId: string, teacherName: string) {
    return await this.createNotification({
      userId,
      title: 'Yêu cầu chỉnh sửa bài nộp',
      content: `Giảng viên ${teacherName} yêu cầu chỉnh sửa bài nộp của bạn.`,
      type: 'YEU_CAU_SUA',
      submissionId,
    });
  }
}
export const notificationService = new NotificationService();
