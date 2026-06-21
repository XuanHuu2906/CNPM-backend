import { prisma } from '../config/prisma';
import { Rubric, Criteria } from '@prisma/client';

export class RubricRepository {
  /**
   * Tạo Rubric kèm danh sách tiêu chí con trong một Transaction duy nhất
   */
  async createRubric(
    data: { title: string; description?: string; teacherId: string },
    criteriaList: Array<{ name: string; description?: string; maxScore: number; weight: number }>
  ) {
    return await prisma.rubric.create({
      data: {
        title: data.title,
        description: data.description,
        teacherId: data.teacherId,
        criteria: {
          create: criteriaList,
        },
      },
      include: {
        criteria: true,
      },
    });
  }

  /**
   * Tìm Rubric theo ID, kèm theo thông số đếm bảng điểm liên kết (để phục vụ khóa sửa đổi)
   */
  async findRubricById(id: string) {
    return await prisma.rubric.findUnique({
      where: { id },
      include: {
        criteria: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { grades: true },
        },
      },
    });
  }

  /**
   * Lấy danh sách toàn bộ Rubric trong hệ thống
   */
  async getAllRubrics() {
    return await prisma.rubric.findMany({
      include: {
        criteria: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { grades: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lấy danh sách Rubric do chính một Giảng viên tạo
   */
  async getTeacherRubrics(teacherId: string) {
    return await prisma.rubric.findMany({
      where: { teacherId },
      include: {
        criteria: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { grades: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Xóa Rubric (Prisma Cascade sẽ tự động xóa Criteria con do onDelete: Cascade định nghĩa ở schema)
   */
  async deleteRubric(id: string): Promise<Rubric> {
    return await prisma.rubric.delete({
      where: { id },
    });
  }
}

export const rubricRepository = new RubricRepository();
