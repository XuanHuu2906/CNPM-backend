import { prisma } from '../config/prisma';

export class NotificationRepository {
  async create(data: {
    userId: string;
    title: string;
    content: string;
    type: string;
    submissionId?: string;
  }) {
    return await prisma.notification.create({ data });
  }

  async findByUserId(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, total, page, limit };
  }

  async countUnread(userId: string) {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string) {
    return await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
export const notificationRepository = new NotificationRepository();
