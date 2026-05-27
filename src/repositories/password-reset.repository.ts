import { prisma } from '../config/prisma';
import crypto from 'crypto';

export class PasswordResetRepository {
  async create(userId: string, expiresInMinutes = 30) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    return await prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findByToken(token: string) {
    return await prisma.passwordResetToken.findUnique({
      where: { token },
    });
  }

  async markAsUsed(id: string) {
    return await prisma.passwordResetToken.update({
      where: { id },
      data: { isUsed: true },
    });
  }

  async invalidatePreviousTokens(userId: string) {
    return await prisma.passwordResetToken.updateMany({
      where: { userId, isUsed: false },
      data: { isUsed: true },
    });
  }
}
export const passwordResetRepository = new PasswordResetRepository();
