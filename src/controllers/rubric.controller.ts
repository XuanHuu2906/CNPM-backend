import { Request, Response } from 'express';
import { rubricService } from '../services/rubric.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';
import { UserRole } from '@prisma/client';

export class RubricController {
  async createRubric(req: Request, res: Response) {
    const { title, description, criteria } = req.body;
    
    // Tìm ID Giảng viên sở hữu tương ứng
    let teacherId = req.user?.actorId;

    // Nếu Admin hoặc Phòng Đào Tạo tạo, họ phải truyền kèm teacherId của Giảng viên được phân bổ
    if (req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.ACADEMIC_DEPT) {
      teacherId = req.body.teacherId || teacherId;
    }

    if (!teacherId) {
      throw new BadRequestError("Tác nhân tạo Rubric phải được liên kết với một ID Giảng viên cụ thể");
    }

    const rubric = await rubricService.createRubric(
      { title, description, teacherId },
      criteria
    );

    return ApiResponse.created(res, "Thiết lập bảng tiêu chí Rubric thành công", rubric);
  }

  async getAllRubrics(req: Request, res: Response) {
    let rubrics;
    // Nếu Giảng viên xem, chỉ hiển thị Rubric của chính họ (hoặc toàn cục nếu cần)
    if (req.user?.role === UserRole.TEACHER) {
      rubrics = await rubricService.getTeacherRubrics(req.user.actorId!);
    } else {
      rubrics = await rubricService.getAllRubrics();
    }
    return ApiResponse.success(res, "Lấy danh sách bảng tiêu chí Rubric thành công", rubrics);
  }

  async getRubricById(req: Request, res: Response) {
    const { id } = req.params;
    const rubric = await rubricService.getRubricById(id);
    return ApiResponse.success(res, "Lấy chi tiết bảng Rubric thành công", rubric);
  }

  async deleteRubric(req: Request, res: Response) {
    const { id } = req.params;
    await rubricService.deleteRubric(id);
    return ApiResponse.success(res, "Xóa bảng Rubric thành công");
  }
}

export const rubricController = new RubricController();
