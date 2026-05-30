import { prisma } from '../config/prisma';
import { SystemConfig, SystemLog } from '@prisma/client';

export class SystemRepository {
  // ==========================================
  // SYSTEM LOGS (NHẬT KÝ HỆ THỐNG - UC-21)
  // ==========================================

  async createLog(userId: string | null, action: string, description: string, ipAddress?: string): Promise<SystemLog> {
    return await prisma.systemLog.create({
      data: {
        userId,
        action,
        description,
        ipAddress: ipAddress ?? null,
      },
    });
  }

  async getLogs(skip: number, take: number): Promise<any[]> {
    return await prisma.systemLog.findMany({
      include: {
        user: {
          select: { email: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async getLogsCount(): Promise<number> {
    return await prisma.systemLog.count();
  }

  // ==========================================
  // SYSTEM CONFIGS (CẤU HÌNH HỆ THỐNG - UC-14)
  // ==========================================

  async upsertConfig(key: string, value: string, description?: string): Promise<SystemConfig> {
    return await prisma.systemConfig.upsert({
      where: { key },
      update: { value, description: description ?? undefined },
      create: { key, value, description: description ?? null },
    });
  }

  async getConfigByKey(key: string): Promise<SystemConfig | null> {
    return await prisma.systemConfig.findUnique({ where: { key } });
  }

  async getAllConfigs(): Promise<SystemConfig[]> {
    return await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  // ==========================================
  // PORTABLE JSON BACKUP & RESTORE (UC-18)
  // ==========================================

  /**
   * Đọc dữ liệu thô của toàn bộ 18 bảng dữ liệu hiện có trong Prisma
   */
  async exportAllTables(): Promise<any> {
    return {
      users: await prisma.user.findMany(),
      admins: await prisma.admin.findMany(),
      academicDepts: await prisma.academicDept.findMany(),
      teachers: await prisma.teacher.findMany(),
      subjects: await prisma.subject.findMany(),
      academicTerms: await prisma.academicTerm.findMany(),
      classes: await prisma.class.findMany(),
      classEnrollments: await prisma.classEnrollment.findMany(),
      groups: await prisma.group.findMany(),
      groupMembers: await prisma.groupMember.findMany(),
      students: await prisma.student.findMany(),
      assignments: await prisma.assignment.findMany(),
      rubrics: await prisma.rubric.findMany(),
      criteria: await prisma.criteria.findMany(),
      submissions: await prisma.submission.findMany(),
      submissionLogs: await prisma.submissionLog.findMany(),
      grades: await prisma.grade.findMany(),
      comments: await prisma.comment.findMany(),
      systemConfigs: await prisma.systemConfig.findMany(),
      systemLogs: await prisma.systemLog.findMany(),
    };
  }

  /**
   * Khôi phục cơ sở dữ liệu từ cấu trúc JSON đã sao lưu lồng trong 1 Prisma Transaction khép kín.
   * Xóa sạch dữ liệu cũ theo thứ tự liên kết khóa ngoại ngược, sau đó nạp mới hoàn chỉnh.
   */
  async importAllTables(data: any): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Thực hiện xóa sạch tất cả bảng dữ liệu cũ (Xóa bảng con có khóa ngoại trước)
      await tx.systemLog.deleteMany();
      await tx.systemConfig.deleteMany();
      await tx.comment.deleteMany();
      await tx.grade.deleteMany();
      await tx.submissionLog.deleteMany();
      await tx.submission.deleteMany();
      await tx.criteria.deleteMany();
      await tx.rubric.deleteMany();
      await tx.assignment.deleteMany();
      await tx.groupMember.deleteMany();
      await tx.group.deleteMany();
      await tx.classEnrollment.deleteMany();
      await tx.class.deleteMany();
      await tx.academicTerm.deleteMany();
      await tx.subject.deleteMany();
      await tx.student.deleteMany();
      await tx.teacher.deleteMany();
      await tx.academicDept.deleteMany();
      await tx.admin.deleteMany();
      await tx.user.deleteMany();

      // 2. Tiến hành ghi đè dữ liệu mới khôi phục hàng loạt theo thứ tự quan hệ khóa ngoại xuôi
      if (data.users?.length) await tx.user.createMany({ data: data.users });
      if (data.admins?.length) await tx.admin.createMany({ data: data.admins });
      if (data.academicDepts?.length) await tx.academicDept.createMany({ data: data.academicDepts });
      if (data.teachers?.length) await tx.teacher.createMany({ data: data.teachers });
      if (data.academicTerms?.length) await tx.academicTerm.createMany({ data: data.academicTerms });
      if (data.subjects?.length) await tx.subject.createMany({ data: data.subjects });
      if (data.students?.length) await tx.student.createMany({ data: data.students });
      if (data.assignments?.length) await tx.assignment.createMany({ data: data.assignments });
      if (data.classes?.length) await tx.class.createMany({ data: data.classes });
      if (data.classEnrollments?.length) await tx.classEnrollment.createMany({ data: data.classEnrollments });
      if (data.groups?.length) await tx.group.createMany({ data: data.groups });
      if (data.groupMembers?.length) await tx.groupMember.createMany({ data: data.groupMembers });
      if (data.rubrics?.length) await tx.rubric.createMany({ data: data.rubrics });
      if (data.criteria?.length) await tx.criteria.createMany({ data: data.criteria });
      if (data.submissions?.length) await tx.submission.createMany({ data: data.submissions });
      if (data.submissionLogs?.length) await tx.submissionLog.createMany({ data: data.submissionLogs });
      if (data.grades?.length) await tx.grade.createMany({ data: data.grades });
      if (data.comments?.length) await tx.comment.createMany({ data: data.comments });
      if (data.systemConfigs?.length) await tx.systemConfig.createMany({ data: data.systemConfigs });
      if (data.systemLogs?.length) await tx.systemLog.createMany({ data: data.systemLogs });
    });
  }
}

export const systemRepository = new SystemRepository();
