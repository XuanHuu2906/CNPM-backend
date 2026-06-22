import { prisma } from '../config/prisma';
import { ForbiddenError } from './apiResponse';

export async function verifyTeacherClassOwnership(classId: string, teacherId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { classId, teacherId },
  });
  if (!assignment) {
    throw new ForbiddenError('Bạn không được phân công phụ trách lớp học phần này');
  }
  return assignment;
}
