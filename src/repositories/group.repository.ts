import { prisma } from '../config/prisma';
import { Group } from '@prisma/client';

export class GroupRepository {
  /**
   * Tạo Nhóm mới và tạo GroupMember records cho tất cả sinh viên tham gia
   */
  async createGroup(data: { name: string; topicName: string; classId: string; studentIds: string[] }): Promise<Group> {
    const { name, topicName, classId, studentIds } = data;
    return await prisma.$transaction(async (tx) => {
      // 1. Tạo Group
      const group = await tx.group.create({
        data: {
          name,
          topicName,
          classId,
        },
      });

      // 2. Tạo GroupMember records
      if (studentIds.length > 0) {
        await tx.groupMember.createMany({
          data: studentIds.map(studentId => ({
            groupId: group.id,
            studentId,
          })),
        });
      }

      return group;
    });
  }

  /**
   * Tìm Nhóm theo ID, kèm theo danh sách thành viên và thông tin cá nhân
   */
  async findGroupById(id: string) {
    return await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phoneNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Lấy danh sách toàn bộ các Nhóm đề tài thuộc về 1 Lớp học phần
   */
  async findGroupsByClassId(classId: string) {
    return await prisma.group.findMany({
      where: { classId },
      include: {
        members: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phoneNumber: true,
                  },
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
   * Cập nhật tên đề tài
   */
  async updateTopic(id: string, topicName: string): Promise<Group> {
    return await prisma.group.update({
      where: { id },
      data: { topicName },
    });
  }

  /**
   * Điều chỉnh danh sách thành viên nhóm thông qua GroupMember
   */
  async updateMembers(id: string, studentIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Xóa tất cả GroupMember cũ của nhóm này
      await tx.groupMember.deleteMany({
        where: { groupId: id },
      });

      // 2. Tạo GroupMember mới cho các sinh viên được chỉ định
      if (studentIds.length > 0) {
        await tx.groupMember.createMany({
          data: studentIds.map(studentId => ({
            groupId: id,
            studentId,
          })),
        });
      }
    });
  }

  /**
   * Giải tán/Xóa nhóm (cascade sẽ tự xóa GroupMember)
   */
  async deleteGroup(id: string): Promise<Group> {
    return await prisma.group.delete({
      where: { id },
    });
  }

  /**
   * Tìm thông tin Student theo ID bao gồm thông tin nhóm hiện tại qua GroupMember
   */
  async findStudentWithGroup(studentId: string) {
    return await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        groupMemberships: {
          include: {
            group: true,
          },
        },
      },
    });
  }

  /**
   * Tìm danh sách học sinh theo mảng IDs, kèm enrollments và group memberships để kiểm duyệt
   */
  async findStudentsForValidation(studentIds: string[]) {
    return await prisma.student.findMany({
      where: {
        id: { in: studentIds },
      },
      include: {
        enrollments: true,
        groupMemberships: {
          include: {
            group: true,
          },
        },
        user: true,
      },
    });
  }
}

export const groupRepository = new GroupRepository();
