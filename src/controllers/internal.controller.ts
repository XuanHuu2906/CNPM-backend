import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { studentNotificationService } from '../services/student-notification.service';
import { submissionRepository } from '../repositories/submission.repository';
import { prisma } from '../config/prisma';

export class InternalController {
  async triggerDeadlineReminders(req: Request, res: Response) {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      const termsNearDeadline = await prisma.academicTerm.findMany({
        where: {
          endDate: { gt: now, lte: next24h }
        },
        include: {
          classes: {
            include: {
              groups: {
                include: {
                  submissions: true,
                  members: { include: { student: { include: { user: true } } } }
                }
              },
              enrollments: {
                include: { student: { include: { user: true } } }
              }
            }
          }
        }
      });

      let emailsSentCount = 0;

      for (const term of termsNearDeadline) {
        const diffHours = Math.round((term.endDate.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        for (const cls of term.classes) {
          const studentsInGroups = new Set<string>();

          // 1. Nhóm
          for (const group of cls.groups) {
            group.members.forEach((m: any) => studentsInGroups.add(m.studentId));

            if (group.submissions.length === 0) {
              const users = group.members.map((m: any) => m.student.user);
              if (users.length > 0) {
                const topic = group.topicName || 'Chưa có đề tài';
                await studentNotificationService.remindDeadline(users, topic, `GROUP:${group.id}`, diffHours);
                emailsSentCount += users.length;
              }
            }
          }

          // 2. Cá nhân (chưa có nhóm)
          for (const enrollment of cls.enrollments) {
            const studentId = enrollment.studentId;
            if (!studentsInGroups.has(studentId)) {
              // Tìm bài nộp cá nhân
              const sub = await submissionRepository.findStudentSubmissionInClass(studentId, null);
              if (!sub) {
                const user = enrollment.student.user;
                if (user) {
                  await studentNotificationService.remindDeadline([user], 'Báo cáo cá nhân', `STUDENT:${studentId}:CLASS:${cls.id}`, diffHours);
                  emailsSentCount++;
                }
              }
            }
          }
        }
      }

      return ApiResponse.success(res, "Cron job finished", { emailsSentCount });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Cron job failed" });
    }
  }
}

export const internalController = new InternalController();
