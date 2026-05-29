import { prisma } from '../config/prisma';
import { academicService } from './academic.service';
import { academicRepository } from '../repositories/academic.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/apiResponse';

export class TeacherService {
  /**
   * Kiểm tra giảng viên có được phân công LHP này không
   */
  private async verifyOwnership(classId: string, teacherId: string) {
    const assignment = await prisma.assignment.findFirst({
      where: { classId, teacherId },
    });
    if (!assignment) {
      throw new ForbiddenError("Bạn không được phân công phụ trách lớp học phần này");
    }
    return assignment;
  }

  /**
   * Lấy danh sách LHP được phân công cho giảng viên
   */
  async getAssignedClassSections(teacherId: string) {
    const assignments = await prisma.assignment.findMany({
      where: { teacherId },
      include: {
        class: {
          include: {
            subject: true,
            term: true,
            _count: {
              select: { enrollments: true, groups: true },
            },
          },
        },
      },
    });

    return assignments.map(a => ({
      id: a.class.id,
      classCode: a.class.classCode,
      subject: a.class.subject,
      term: a.class.term,
      studentCount: a.class._count.enrollments,
      groupCount: a.class._count.groups,
    }));
  }

  /**
   * Lấy danh sách SV đã enroll LHP, kèm trạng thái nhóm
   */
  async getStudentsByClassId(classId: string, teacherId: string) {
    await this.verifyOwnership(classId, teacherId);

    const enrollments = await academicRepository.getStudentsByClassId(classId);

    return enrollments.map(e => {
      const groupInClass = e.student.groupMemberships.find(
        gm => gm.group.classId === classId
      );
      return {
        id: e.student.id,
        studentCode: e.student.studentCode,
        fullName: e.student.user.fullName,
        email: e.student.user.email,
        groupId: groupInClass?.group.id || null,
        groupName: groupInClass?.group.name || null,
        enrolledAt: e.createdAt,
      };
    });
  }

  /**
   * Lấy nhóm của LHP, kèm members + topic
   */
  async getGroupsByClassId(classId: string, teacherId: string) {
    await this.verifyOwnership(classId, teacherId);

    return await prisma.group.findMany({
      where: { classId },
      include: {
        members: {
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
        submissions: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Tạo nhóm + GroupMember
   */
  async createGroup(classId: string, teacherId: string, data: { name: string; topicName?: string; studentIds: string[] }) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    // Validate students enrolled & not in another group in same class
    if (data.studentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: data.studentIds } },
        include: {
          enrollments: true,
          groupMemberships: { include: { group: true } },
          user: true,
        },
      });

      if (students.length !== data.studentIds.length) {
        throw new BadRequestError("Một số sinh viên không tồn tại");
      }

      for (const s of students) {
        if (!s.enrollments.some(e => e.classId === classId)) {
          throw new BadRequestError(`Sinh viên '${s.user.fullName}' không đăng ký lớp học phần này`);
        }
        if (s.groupMemberships.some(gm => gm.group.classId === classId)) {
          throw new BadRequestError(`Sinh viên '${s.user.fullName}' đã thuộc nhóm khác trong lớp này`);
        }
      }
    }

    return await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: data.name,
          topicName: data.topicName || '',
          classId,
        },
      });

      if (data.studentIds.length > 0) {
        await tx.groupMember.createMany({
          data: data.studentIds.map(studentId => ({
            groupId: group.id,
            studentId,
          })),
        });
      }

      return group;
    });
  }

  /**
   * Sửa tên nhóm
   */
  async updateGroupName(groupId: string, teacherId: string, name: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    return await prisma.group.update({
      where: { id: groupId },
      data: { name },
    });
  }

  /**
   * Xóa nhóm — chặn nếu đã có submission
   */
  async deleteGroup(groupId: string, teacherId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { submissions: { select: { id: true } } },
    });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    if (group.submissions.length > 0) {
      throw new BadRequestError("Không thể xóa nhóm đã có bài nộp");
    }

    return await prisma.group.delete({ where: { id: groupId } });
  }

  /**
   * Thêm SV vào nhóm
   */
  async addMember(groupId: string, teacherId: string, studentId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    // Check enrolled
    const enrollment = await academicRepository.findEnrollment(studentId, group.classId);
    if (!enrollment) {
      throw new BadRequestError("Sinh viên không đăng ký lớp học phần này");
    }

    // Check not in another group in same class
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        studentId,
        group: { classId: group.classId },
      },
    });
    if (existingMembership) {
      throw new BadRequestError("Sinh viên đã thuộc nhóm khác trong lớp này");
    }

    return await prisma.groupMember.create({
      data: { groupId, studentId },
    });
  }

  /**
   * Gỡ SV khỏi nhóm
   */
  async removeMember(groupId: string, teacherId: string, studentId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
    });
    if (!membership) {
      throw new NotFoundError("Sinh viên không thuộc nhóm này");
    }

    return await prisma.groupMember.delete({
      where: { id: membership.id },
    });
  }

  /**
   * Cập nhật đề tài
   */
  async updateGroupTopic(groupId: string, teacherId: string, topicName: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    return await prisma.group.update({
      where: { id: groupId },
      data: { topicName },
    });
  }

  /**
   * Tự động chia nhóm
   */
  async autoGenerateGroups(classId: string, teacherId: string, targetSize: number) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    // Lấy SV chưa có nhóm trong LHP
    const enrollments = await academicRepository.getStudentsByClassId(classId);
    const ungroupedStudentIds = enrollments
      .filter(e => !e.student.groupMemberships.some(gm => gm.group.classId === classId))
      .map(e => e.student.id);

    if (ungroupedStudentIds.length === 0) {
      throw new BadRequestError("Tất cả sinh viên đã có nhóm trong lớp này");
    }

    // Tính số nhóm cần tạo
    const groupCount = Math.ceil(ungroupedStudentIds.length / targetSize);

    // Tìm số nhóm hiện có để đánh số tiếp
    const existingGroups = await prisma.group.count({ where: { classId } });

    const createdGroups: any[] = [];

    return await prisma.$transaction(async (tx) => {
      for (let i = 0; i < groupCount; i++) {
        const start = i * targetSize;
        const end = Math.min(start + targetSize, ungroupedStudentIds.length);
        const memberIds = ungroupedStudentIds.slice(start, end);

        const group = await tx.group.create({
          data: {
            name: `Nhóm ${existingGroups + i + 1}`,
            topicName: '',
            classId,
          },
        });

        await tx.groupMember.createMany({
          data: memberIds.map(studentId => ({
            groupId: group.id,
            studentId,
          })),
        });

        createdGroups.push({
          ...group,
          memberCount: memberIds.length,
        });
      }

      return createdGroups;
    });
  }
  /**
   * Import hàng loạt nhóm và thành viên từ Excel/CSV
   */
  async importGroupsBatch(classId: string, teacherId: string, groupsData: { name: string, topicName?: string, studentCodes: string[] }[]) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    // Lấy toàn bộ SV trong lớp để map studentCode -> studentId
    const enrollments = await academicRepository.getStudentsByClassId(classId);
    
    // Map sinh viên với thông tin nhóm hiện tại
    const studentMap = new Map<string, { id: string, hasGroup: boolean }>();
    for (const e of enrollments) {
      const hasGroup = e.student.groupMemberships.some(gm => gm.group.classId === classId);
      studentMap.set(e.student.studentCode.toUpperCase(), { id: e.student.id, hasGroup });
    }

    return await prisma.$transaction(async (tx) => {
      const createdGroups: any[] = [];

      for (const groupInput of groupsData) {
        // Validate và lấy student IDs
        const validStudentIds: string[] = [];
        
        for (const code of groupInput.studentCodes) {
          const upperCode = code.trim().toUpperCase();
          const studentInfo = studentMap.get(upperCode);
          if (!studentInfo) {
            throw new BadRequestError(`Sinh viên có mã '${code}' không đăng ký lớp học phần này`);
          }
          if (studentInfo.hasGroup) {
            throw new BadRequestError(`Sinh viên có mã '${code}' đã thuộc nhóm khác trong lớp này`);
          }
          validStudentIds.push(studentInfo.id);
          
          // Mark as having group to prevent duplicates in the same file
          studentInfo.hasGroup = true;
          studentMap.set(upperCode, studentInfo);
        }

        // Tạo nhóm
        const group = await tx.group.create({
          data: {
            name: groupInput.name,
            topicName: groupInput.topicName || '',
            classId,
          },
        });

        // Thêm thành viên
        if (validStudentIds.length > 0) {
          await tx.groupMember.createMany({
            data: validStudentIds.map(studentId => ({
              groupId: group.id,
              studentId,
            })),
          });
        }

        createdGroups.push({
          ...group,
          memberCount: validStudentIds.length
        });
      }

      return createdGroups;
    });
  }
}

export const teacherService = new TeacherService();
