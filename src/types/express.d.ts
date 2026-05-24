import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        fullName: string;
        actorId: string; // ID của bảng vai trò cụ thể (Admin, Teacher, Student, AcademicDept)
      };
    }
  }
}
export {};
