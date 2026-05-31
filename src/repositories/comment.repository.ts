import { prisma } from '../config/prisma';

export class CommentRepository {
  async create(data: { submissionId: string; userId: string; content: string }) {
    return await prisma.comment.create({
      data: {
        submissionId: data.submissionId,
        userId: data.userId,
        content: data.content,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });
  }

  async findBySubmissionId(submissionId: string) {
    return await prisma.comment.findMany({
      where: { submissionId, isHidden: false },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return await prisma.comment.findUnique({
      where: { id },
    });
  }

  async softDelete(id: string) {
    return await prisma.comment.update({
      where: { id },
      data: { isHidden: true },
    });
  }
}
export const commentRepository = new CommentRepository();
