import { rubricRepository } from '../repositories/rubric.repository';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { Rubric } from '@prisma/client';

export class RubricService {
  /**
   * Tạo Rubric kèm tiêu chí con, kiểm duyệt tổng trọng số bằng 100%
   */
  async createRubric(
    data: { title: string; description?: string; teacherId: string },
    criteriaList: Array<{ name: string; description?: string; maxScore: number; weight: number }>
  ) {
    // 1. Kiểm tra tổng trọng số %
    const totalWeight = criteriaList.reduce((sum, c) => sum + c.weight, 0);
    // Cho phép dung sai cực nhỏ để tránh lỗi dấu phẩy động
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new BadRequestError(`Tổng trọng số (%) của các tiêu chí con phải bằng chính xác 100% (Hiện tại là: ${totalWeight}%)`);
    }

    return await rubricRepository.createRubric(data, criteriaList);
  }

  /**
   * Xem chi tiết Rubric
   */
  async getRubricById(id: string) {
    const rubric = await rubricRepository.findRubricById(id);
    if (!rubric) {
      throw new NotFoundError("Không tìm thấy thông tin bảng Rubric yêu cầu");
    }
    return rubric;
  }

  /**
   * Lấy danh sách toàn bộ Rubric
   */
  async getAllRubrics() {
    return await rubricRepository.getAllRubrics();
  }

  /**
   * Lấy danh sách Rubric của giảng viên
   */
  async getTeacherRubrics(teacherId: string) {
    return await rubricRepository.getTeacherRubrics(teacherId);
  }

  /**
   * Xóa Rubric (chỉ cho phép khi chưa có bản ghi điểm nào liên kết)
   */
  async deleteRubric(id: string): Promise<Rubric> {
    const rubric = await rubricRepository.findRubricById(id);
    if (!rubric) {
      throw new NotFoundError("Không tìm thấy thông tin bảng Rubric để xóa");
    }

    // Chốt chặn bảo mật: Nếu đã có điểm chấm dùng Rubric này, cấm xóa!
    if (rubric._count.grades > 0) {
      throw new BadRequestError("Không thể xóa bảng Rubric này vì nó đã được sử dụng để chấm điểm bài báo cáo môn học");
    }

    return await rubricRepository.deleteRubric(id);
  }
}

export const rubricService = new RubricService();
