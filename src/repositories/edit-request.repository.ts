import { prisma } from '../config/prisma';

export class EditRequestRepository {
  async create(data: { submissionId: string; teacherId: string; content: string }) {
    return await prisma.editRequest.create({
      data: {
        submissionId: data.submissionId,
        teacherId: data.teacherId,
        content: data.content,
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
  }

  async findBySubmissionId(submissionId: string) {
    return await prisma.editRequest.findMany({
      where: { submissionId },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
export const editRequestRepository = new EditRequestRepository();
