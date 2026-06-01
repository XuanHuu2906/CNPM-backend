import { prisma } from '../config/prisma';
import { AcademicTerm, Subject, Class, Assignment } from '@prisma/client';

export class AcademicRepository {
  // ==========================================
  // ACADEMIC TERM (HỌC KỲ)
  // ==========================================

  async createTerm(data: { name: string; startDate: Date; endDate: Date }): Promise<AcademicTerm> {
    return await prisma.academicTerm.create({ data });
  }

  async findTermById(id: string): Promise<AcademicTerm | null> {
    return await prisma.academicTerm.findUnique({ where: { id } });
  }

  async findTermByName(name: string): Promise<AcademicTerm | null> {
    return await prisma.academicTerm.findUnique({ where: { name } });
  }

  async updateTerm(id: string, data: Partial<{ name: string; startDate: Date; endDate: Date; isLocked: boolean }>): Promise<AcademicTerm> {
    return await prisma.academicTerm.update({
      where: { id },
      data,
    });
  }

  async getAllTerms(): Promise<AcademicTerm[]> {
    return await prisma.academicTerm.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  // ==========================================
  // SUBJECT (MÔN HỌC)
  // ==========================================

  async createSubject(data: { subjectCode: string; name: string }): Promise<Subject> {
    return await prisma.subject.create({ data });
  }

  async findSubjectById(id: string): Promise<Subject | null> {
    return await prisma.subject.findUnique({ where: { id } });
  }

  async findSubjectByCode(subjectCode: string): Promise<Subject | null> {
    return await prisma.subject.findUnique({ where: { subjectCode } });
  }

  async getAllSubjects(): Promise<Subject[]> {
    return await prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // ==========================================
  // CLASS (LỚP HỌC PHẦN)
  // ==========================================

  async createClass(data: { classCode: string; subjectId: string; termId: string }): Promise<Class> {
    return await prisma.class.create({ data });
  }

  async findClassById(id: string) {
    return await prisma.class.findUnique({
      where: { id },
      include: {
        subject: true,
        term: true,
        assignments: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  }
                }
              }
            }
          }
        }
      },
    });
  }

  async findClassByCode(classCode: string): Promise<Class | null> {
    return await prisma.class.findUnique({ where: { classCode } });
  }

  async getAllClasses() {
    return await prisma.class.findMany({
      include: {
        subject: true,
        term: true,
        assignments: {
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { classCode: 'asc' },
    });
  }

  // ==========================================
  // ASSIGNMENT (PHÂN CÔNG GIẢNG DẠY)
  // ==========================================

  async assignTeacher(data: { classId: string; teacherId: string }): Promise<Assignment> {
    return await prisma.assignment.create({ data });
  }

  async unassignTeacher(classId: string, teacherId: string): Promise<Assignment> {
    return await prisma.assignment.delete({
      where: {
        classId_teacherId: { classId, teacherId },
      },
    });
  }

  async findAssignment(classId: string, teacherId: string): Promise<Assignment | null> {
    return await prisma.assignment.findUnique({
      where: {
        classId_teacherId: { classId, teacherId },
      },
    });
  }

  async getTeacherAssignments(teacherId: string) {
    return await prisma.assignment.findMany({
      where: { teacherId },
      include: {
        class: {
          include: {
            subject: true,
            term: true,
          },
        },
      },
    });
  }

  // ==========================================
  // CLASS ENROLLMENT (ĐĂNG KÝ LỚP HỌC PHẦN)
  // ==========================================

  async createEnrollment(studentId: string, classId: string) {
    return await prisma.classEnrollment.create({
      data: { studentId, classId },
    });
  }

  async findEnrollment(studentId: string, classId: string) {
    return await prisma.classEnrollment.findUnique({
      where: {
        studentId_classId: { studentId, classId },
      },
    });
  }

  async getStudentsByClassId(classId: string) {
    return await prisma.classEnrollment.findMany({
      where: { classId },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            groupMemberships: {
              include: {
                group: {
                  select: {
                    id: true,
                    name: true,
                    classId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}

export const academicRepository = new AcademicRepository();
