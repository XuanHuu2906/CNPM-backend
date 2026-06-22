import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiResponse';

/**
 * Middleware kiểm tra quyền truy cập bài nộp dựa trên vai trò:
 * - STUDENT: phải là chủ bài nộp (studentId) hoặc là thành viên nhóm nộp (groupId).
 * - TEACHER: phải được phân công lớp học phần chứa bài nộp.
 * - ADMIN / ACADEMIC_DEPT: được phép.
 */
export const verifySubmissionOwnership = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Yêu cầu xác thực tài khoản.');
    }

    const submissionId = req.params.id;
    if (!submissionId) {
      throw new ForbiddenError('Thiếu định danh bài nộp.');
    }

    const role = req.user.role;
    if (role === UserRole.ADMIN || role === UserRole.ACADEMIC_DEPT) {
      return next();
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        groupId: true,
        group: { select: { classId: true } },
      },
    });

    if (!submission) {
      throw new NotFoundError('Không tìm thấy bài nộp.');
    }

    const actorId = req.user.actorId;

    if (role === UserRole.STUDENT) {
      if (submission.studentId && submission.studentId === actorId) {
        return next();
      }
      if (submission.groupId) {
        const isMember = await prisma.groupMember.findFirst({
          where: { groupId: submission.groupId, studentId: actorId },
          select: { id: true },
        });
        if (isMember) return next();
      }
      throw new ForbiddenError('Bạn không có quyền truy cập bài nộp này.');
    }

    if (role === UserRole.TEACHER) {
      const classId = submission.group?.classId;
      if (!classId) {
        throw new ForbiddenError('Bài nộp không thuộc lớp học phần do bạn phụ trách.');
      }
      const assignment = await prisma.assignment.findFirst({
        where: { classId, teacherId: actorId },
        select: { id: true },
      });
      if (!assignment) {
        throw new ForbiddenError('Bạn không được phân công phụ trách lớp học phần này.');
      }
      return next();
    }

    throw new ForbiddenError('Bạn không có quyền truy cập bài nộp này.');
  } catch (error) {
    return next(error);
  }
};
