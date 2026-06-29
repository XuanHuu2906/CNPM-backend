import { prisma } from '../config/prisma';
import { Submission, SubmissionStatus, SubmissionLog } from '@prisma/client';
import { BadRequestError } from '../utils/apiResponse';

export class SubmissionRepository {
  /**
   * Helper chuyển đổi trường attachments từ chuỗi phân tách bởi dấu phẩy trong CSDL (MSSQL) thành mảng string[]
   */
  private mapSubmission(submission: any): any {
    if (!submission) return null;
    return {
      ...submission,
      attachments: submission.attachments ? submission.attachments.split(',').filter(Boolean) : [],
    };
  }

  /**
   * Tạo bài nộp mới và ghi log vết lịch sử ban đầu (CHUA_NOP -> DA_NOP)
   */
  async createSubmission(
    data: {
      studentId?: string | null;
      groupId?: string | null;
      filePath: string;
      attachments: string[];
      status: SubmissionStatus;
      repoLink?: string | null;
      videoLink?: string | null;
    },
    actorId: string
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi Submission
      const submission = await tx.submission.create({
        data: {
          studentId: data.studentId ?? null,
          groupId: data.groupId ?? null,
          filePath: data.filePath,
          attachments: data.attachments.join(','), // Ghép mảng thành chuỗi phân tách bởi dấu phẩy cho MSSQL
          status: data.status,
          repoLink: data.repoLink ?? null,
          videoLink: data.videoLink ?? null,
        },
      });

      // 2. Tạo bản ghi SubmissionLog ban đầu
      await tx.submissionLog.create({
        data: {
          submissionId: submission.id,
          oldStatus: SubmissionStatus.CHUA_NOP,
          newStatus: data.status,
          actorId,
          note: "Sinh viên nộp bài báo cáo thành công lên hệ thống",
        },
      });

      return this.mapSubmission(submission);
    });
  }

  /**
   * Sinh viên nộp đè bài mới (Cập nhật filePath, attachments và trạng thái về DA_NOP) kèm OCC
   */
  async resubmitReport(
    id: string,
    currentVersion: number,
    data: {
      filePath: string;
      attachments: string[];
      repoLink?: string | null;
      videoLink?: string | null;
    },
    actorId: string
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // Lấy trạng thái hiện tại trước khi cập nhật
      const current = await tx.submission.findUnique({ where: { id } });
      const oldStatus = current?.status ?? SubmissionStatus.DA_NOP;

      // Cập nhật với cơ chế OCC
      const updateResult = await tx.submission.updateMany({
        where: {
          id,
          version: currentVersion,
        },
        data: {
          filePath: data.filePath,
          attachments: data.attachments.join(','), // Ghép mảng thành chuỗi cho MSSQL
          status: SubmissionStatus.DA_NOP,
          version: { increment: 1 },
          editRequestNote: null, // Reset yêu cầu sửa đổi cũ
          rejectReason: null,    // Reset từ chối cũ
          repoLink: data.repoLink ?? null,
          videoLink: data.videoLink ?? null,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestError("Bài nộp đã bị thay đổi bởi phiên làm việc khác. Vui lòng tải lại trang.");
      }

      // Tạo bản ghi log trạng thái
      await tx.submissionLog.create({
        data: {
          submissionId: id,
          oldStatus,
          newStatus: SubmissionStatus.DA_NOP,
          actorId,
          note: "Sinh viên nộp đè bài báo cáo mới thành công",
        },
      });

      const updated = await tx.submission.findUniqueOrThrow({ where: { id } });
      return this.mapSubmission(updated);
    });
  }

  /**
   * Tìm chi tiết bài nộp theo ID kèm liên kết phong phú
   */
  async findSubmissionById(id: string): Promise<any> {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
        group: {
          include: {
            members: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { fullName: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
        grades: {
          include: {
            rubric: {
              include: { criteria: true }
            },
            teacher: {
              include: { user: true },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'asc' },
        },
        statusLogs: {
          orderBy: { createdAt: 'desc' },
        },
        reopenRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.mapSubmission(submission);
  }

  /**
   * Tìm bài nộp hiện tại của Sinh viên (hoặc nhóm của sinh viên) trong lớp học phần.
   * Sau B17: nếu có groupId, ưu tiên tìm theo group (bài nhóm) trước; fallback theo studentId (bài cá nhân).
   */
  async findStudentSubmissionInClass(studentId: string, groupId: string | null): Promise<any> {
    if (groupId) {
      const groupSubmission = await prisma.submission.findFirst({
        where: { groupId },
        include: { grades: true },
      });
      if (groupSubmission) return this.mapSubmission(groupSubmission);
    }

    const personalSubmission = await prisma.submission.findFirst({
      where: { studentId, groupId: null },
      include: { grades: true },
    });
    return this.mapSubmission(personalSubmission);
  }

  /**
   * B9: Tìm bài nộp của SV/Nhóm trong một LHP cụ thể (chính xác hơn findStudentSubmissionInClass).
   * - Bài nhóm: filter submission.groupId in Groups thuộc classId.
   * - Bài cá nhân: filter submission.studentId = X AND SV có enrollment thuộc classId.
   */
  async findStudentSubmissionInClassByClassId(
    studentId: string,
    groupId: string | null,
    classId: string
  ): Promise<any> {
    const orClauses: any[] = [];
    if (groupId) {
      orClauses.push({ groupId, group: { classId } });
    }
    orClauses.push({
      studentId,
      groupId: null,
      student: { enrollments: { some: { classId } } },
    });

    const submission = await prisma.submission.findFirst({
      where: { OR: orClauses },
      include: { grades: true },
    });

    return this.mapSubmission(submission);
  }

  /**
   * Tìm toàn bộ bài nộp của một Lớp học phần
   */
  async findSubmissionsByClassId(classId: string): Promise<any[]> {
    const submissions = await prisma.submission.findMany({
      where: {
        OR: [
          {
            student: {
              enrollments: { some: { classId } },
            },
          },
          { group: { classId } },
        ],
      },
      include: {
        student: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, student: { select: { studentCode: true } } },
            },
          },
        },
        group: {
          include: {
            members: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, fullName: true, email: true, student: { select: { studentCode: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        grades: {
          include: {
            teacher: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions.map((sub) => this.mapSubmission(sub));
  }

  /**
   * Cập nhật trạng thái bài nộp kèm kiểm soát phiên bản OCC và ghi logs lịch sử
   */
  async updateSubmissionStatusWithOCC(
    id: string,
    currentVersion: number,
    data: {
      status: SubmissionStatus;
      editRequestNote?: string | null;
      rejectReason?: string | null;
      // B13: phân loại vi phạm khi từ chối / đưa vào diện kiểm tra.
      violationType?: string | null;
      note?: string | null;
    },
    actorId: string
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 1. Tìm trạng thái cũ
      const current = await tx.submission.findUnique({ where: { id } });
      if (!current) {
        throw new BadRequestError("Không tìm thấy thông tin bài nộp yêu cầu");
      }
      const oldStatus = current.status as SubmissionStatus;

      // 2. Cập nhật trạng thái kèm tăng phiên bản (OCC)
      const updateResult = await tx.submission.updateMany({
        where: {
          id,
          version: currentVersion,
        },
        data: {
          status: data.status,
          editRequestNote: data.editRequestNote ?? null,
          rejectReason: data.rejectReason ?? null,
          violationType: data.violationType ?? null,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestError("Bài nộp đã bị sửa đổi bởi một tiến trình khác trước đó. Vui lòng tải lại trang.");
      }

      // 3. Lưu vết log trạng thái
      await tx.submissionLog.create({
        data: {
          submissionId: id,
          oldStatus,
          newStatus: data.status,
          actorId,
          note: data.note || `Thay đổi trạng thái từ giảng viên hoặc PDT`,
        },
      });

      const updated = await tx.submission.findUniqueOrThrow({ where: { id } });
      return this.mapSubmission(updated);
    });
  }

  /**
   * Tìm toàn bộ bài nộp trong hệ thống (vai trò PDT/Admin)
   */
  async findAllSubmissions(): Promise<any[]> {
    const submissions = await prisma.submission.findMany({
      include: {
        student: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, student: { select: { studentCode: true } } },
            },
            enrollments: {
              include: {
                class: {
                  include: {
                    subject: true,
                    term: true,
                    // Để Dashboard PĐT lấy GV chấm chính (FE đọc class.assignments[0].teacher).
                    assignments: {
                      include: { teacher: { include: { user: { select: { fullName: true } } } } },
                    },
                  },
                },
              },
            },
          },
        },
        group: {
          include: {
            members: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, fullName: true, email: true, student: { select: { studentCode: true } } },
                    },
                  },
                },
              },
            },
            class: {
              include: {
                subject: true,
                term: true,
                assignments: {
                  include: { teacher: { include: { user: { select: { fullName: true } } } } },
                },
              },
            },
          },
        },
        grades: {
          include: {
            teacher: {
              include: { user: { select: { fullName: true } } },
            },
            rubric: {
              include: { criteria: true },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions.map((sub) => this.mapSubmission(sub));
  }
}

export const submissionRepository = new SubmissionRepository();
