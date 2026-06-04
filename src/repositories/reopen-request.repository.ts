import { prisma } from '../config/prisma';
import { GradingReopenRequestStatus, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/apiResponse';

export class ReopenRequestRepository {
  async createRequest(
    teacherId: string,
    submissionId: string,
    reason: string
  ) {
    return await prisma.gradingReopenRequest.create({
      data: {
        teacherId,
        submissionId,
        reason,
        status: GradingReopenRequestStatus.PENDING,
      },
    });
  }

  async findPendingRequest(submissionId: string) {
    return await prisma.gradingReopenRequest.findFirst({
      where: {
        submissionId,
        status: GradingReopenRequestStatus.PENDING,
      },
    });
  }

  async findRequests(filters: any) {
    const where: Prisma.GradingReopenRequestWhereInput = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.teacherId) {
      where.teacherId = filters.teacherId;
    }
    if (filters.classId) {
      where.submission = {
        group: { classId: filters.classId }
      };
    }
    if (filters.semesterId) {
      where.submission = {
        group: {
          class: { termId: filters.semesterId }
        }
      };
    }

    return await prisma.gradingReopenRequest.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: { select: { fullName: true } }
          }
        },
        submission: {
          include: {
            student: { include: { user: { select: { fullName: true } } } },
            group: {
              include: {
                class: {
                  include: { subject: true }
                }
              }
            }
          }
        },
        reviewer: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string) {
    return await prisma.gradingReopenRequest.findUnique({
      where: { id },
      include: {
        submission: {
          include: { group: true }
        }
      }
    });
  }

  async updateRequest(
    id: string,
    status: GradingReopenRequestStatus,
    reviewedById: string,
    reviewNote: string
  ) {
    return await prisma.gradingReopenRequest.update({
      where: { id },
      data: {
        status,
        reviewedById,
        reviewNote,
        reviewedAt: new Date(),
      },
    });
  }
}

export const reopenRequestRepository = new ReopenRequestRepository();
