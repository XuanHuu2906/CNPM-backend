import { Request, Response } from 'express';
import { groupService } from '../services/group.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';
import { UserRole } from '@prisma/client';

export class GroupController {
  async createGroup(req: Request, res: Response) {
    const { name, topicName, classId } = req.body;
    let studentIds: string[] = req.body.studentIds || [];

    // Ràng buộc bảo mật: Nếu Sinh viên tự tạo nhóm (UC-05), bắt buộc phải có tên của chính mình
    const user = req.user;
    if (user && user.role === UserRole.STUDENT) {
      const selfStudentId = user.actorId;
      if (!selfStudentId) {
        throw new BadRequestError("Tài khoản sinh viên chưa được cấu hình ID chi tiết");
      }
      if (!studentIds.includes(selfStudentId)) {
        studentIds.push(selfStudentId); // Tự động thêm bản thân sinh viên vào nhóm
      }
    }

    const group = await groupService.createGroup({
      name,
      topicName,
      classId,
      studentIds,
    });

    return ApiResponse.created(res, "Thành lập nhóm và đăng ký đề tài thành công", group);
  }

  async getGroupsByClassId(req: Request, res: Response) {
    const { classId } = req.params;
    const groups = await groupService.getGroupsByClassId(classId);
    return ApiResponse.success(res, "Lấy danh sách nhóm đề tài của lớp thành công", groups);
  }

  async getGroupById(req: Request, res: Response) {
    const { id } = req.params;
    const group = await groupService.getGroupById(id);
    return ApiResponse.success(res, "Lấy chi tiết nhóm đề tài thành công", group);
  }

  async updateTopic(req: Request, res: Response) {
    const { id } = req.params;
    const { topicName } = req.body;
    
    const actorId = req.user!.actorId!;
    const role = req.user!.role;

    const group = await groupService.updateTopic(id, topicName, actorId, role);
    return ApiResponse.success(res, "Cập nhật tên đề tài nghiên cứu thành công", group);
  }

  async updateMembers(req: Request, res: Response) {
    const { id } = req.params;
    const { studentIds } = req.body;

    await groupService.updateMembers(id, studentIds);
    return ApiResponse.success(res, "Điều chỉnh danh sách thành viên nhóm thành công");
  }
}

export const groupController = new GroupController();
