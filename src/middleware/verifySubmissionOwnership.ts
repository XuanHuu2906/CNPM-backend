import { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiResponse';

/**
 * Factory tạo middleware kiểm tra quyền truy cập bài nộp theo vai trò:
 * - STUDENT: phải là chủ bài nộp (studentId) hoặc thành viên nhóm nộp (groupId).
 * - TEACHER: phải được phân công LHP chứa bài nộp. Với bài nộp cá nhân (không group),
 *   lookup classId qua ClassEnrollment của SV.
 * - ADMIN / ACADEMIC_DEPT: được phép.
 *
 * @param paramName tên route param chứa submissionId (mặc định 'id').
 */
export const verifySubmissionOwnershipBy = (paramName: string = 'id'): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Yêu cầu xác thực tài khoản.');
      }

      const submissionId = req.params[paramName];
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
        // Bài nộp nhóm → classId qua group; bài nộp cá nhân → qua enrollment gần nhất của SV.
        let classId: string | undefined = submission.group?.classId;
        if (!classId && submission.studentId) {
          const enrollment = await prisma.classEnrollment.findFirst({
            where: { studentId: submission.studentId },
            orderBy: { createdAt: 'desc' },
            select: { classId: true },
          });
          classId = enrollment?.classId;
        }
        if (!classId) {
          throw new ForbiddenError('Không xác định được lớp học phần của bài nộp này.');
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

// Backwards-compat: existing routes import { verifySubmissionOwnership } expecting req.params.id
export const verifySubmissionOwnership = verifySubmissionOwnershipBy('id');
