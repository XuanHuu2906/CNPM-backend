import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { InternalServerError } from '../utils/apiResponse';
import { prisma } from '../config/prisma';

const resend = new Resend(env.RESEND_API_KEY);

export class EmailService {
  /**
   * Gửi email đơn giản và ghi log
   */
  async sendEmail(
    to: string | string[], 
    subject: string, 
    html: string,
    type: string = 'DEFAULT',
    dedupeKey?: string
  ) {
    const recipientStr = Array.isArray(to) ? to.join(', ') : to;

    try {
      // 1. Kiểm tra dedupeKey nếu có
      if (dedupeKey) {
        const existing = await prisma.emailLog.findUnique({
          where: { dedupeKey }
        });
        
        if (existing) {
          logger.info(`Skipping email to ${recipientStr} due to existing dedupeKey: ${dedupeKey}`);
          return null; // SKIPPED
        }
      }

      // 2. Tạo log trạng thái PENDING/SENDING
      const log = await prisma.emailLog.create({
        data: {
          recipient: recipientStr,
          type,
          status: 'SENDING',
          dedupeKey
        }
      });

      // 3. Gọi Resend API (Tạm thời gửi hết về mail dev theo yêu cầu)
      const overrideEmail = 'huukongu@gmail.com';
      const { data, error } = await resend.emails.send({
        from: 'CNPM <onboarding@resend.dev>',
        to: [overrideEmail],
        subject: `[TEST cho ${recipientStr}] ${subject}`,
        html,
      });

      if (error) {
        logger.error(`Resend send failed for ${recipientStr}: ${error.message}`);
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', error: error.message }
        });
        return null;
      }

      // 4. Thành công
      logger.info(`Email sent to ${recipientStr}: ${data?.id}`);
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'SENT' }
      });
      
      return data;
    } catch (error: any) {
      logger.error(`EmailService error: ${error.message}`);
      // Không ném lỗi ra ngoài để tránh vỡ luồng chính (Nghiệp vụ quan trọng hơn email)
      return null;
    }
  }

  /**
   * Gửi email đặt lại mật khẩu
   */
  async sendPasswordResetEmail(email: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const html = `
      <h2>Đặt lại mật khẩu</h2>
      <p>Bạn nhận được email này vì đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
      <p>Nhấp vào link bên dưới để đặt lại mật khẩu:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Đặt lại mật khẩu</a>
      <p style="margin-top: 16px;">Link có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
    `;

    return this.sendEmail(email, 'Đặt lại mật khẩu - Hệ thống Chấm điểm Báo cáo', html, 'STUDENT_PASSWORD_RESET');
  }
}

export const emailService = new EmailService();
