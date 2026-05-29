import { Request, Response } from 'express';
import { teacherService } from '../services/teacher.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';

export class TeacherController {
  async getClassSections(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const data = await teacherService.getAssignedClassSections(teacherId);
    return ApiResponse.success(res, "Lấy danh sách lớp học phần được phân công thành công", data);
  }

  async getStudents(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const data = await teacherService.getStudentsByClassId(id, teacherId);
    return ApiResponse.success(res, "Lấy danh sách sinh viên thành công", data);
  }

  async getGroups(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const data = await teacherService.getGroupsByClassId(id, teacherId);
    return ApiResponse.success(res, "Lấy danh sách nhóm thành công", data);
  }

  async createGroup(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { name, topicName, studentIds } = req.body;
    if (!name) throw new BadRequestError("Tên nhóm không được để trống");
    const data = await teacherService.createGroup(id, teacherId, {
      name,
      topicName,
      studentIds: studentIds || [],
    });
    return ApiResponse.created(res, "Tạo nhóm thành công", data);
  }

  async updateGroup(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { name, topicName } = req.body;

    let result;
    if (name !== undefined) {
      result = await teacherService.updateGroupName(id, teacherId, name);
    }
    if (topicName !== undefined) {
      result = await teacherService.updateGroupTopic(id, teacherId, topicName);
    }

    return ApiResponse.success(res, "Cập nhật nhóm thành công", result);
  }

  async deleteGroup(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    await teacherService.deleteGroup(id, teacherId);
    return ApiResponse.success(res, "Xóa nhóm thành công");
  }

  async addMember(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { studentId } = req.body;
    if (!studentId) throw new BadRequestError("Mã sinh viên không được để trống");
    const data = await teacherService.addMember(id, teacherId, studentId);
    return ApiResponse.created(res, "Thêm thành viên thành công", data);
  }

  async removeMember(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id, studentId } = req.params;
    await teacherService.removeMember(id, teacherId, studentId);
    return ApiResponse.success(res, "Gỡ thành viên thành công");
  }

  async updateTopic(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { topicName } = req.body;
    const data = await teacherService.updateGroupTopic(id, teacherId, topicName);
    return ApiResponse.success(res, "Cập nhật đề tài thành công", data);
  }

  async autoGenerateGroups(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { targetSize } = req.body;
    if (!targetSize || targetSize < 1) throw new BadRequestError("Kích cỡ nhóm phải >= 1");
    const data = await teacherService.autoGenerateGroups(id, teacherId, targetSize);
    return ApiResponse.created(res, "Tự động chia nhóm thành công", data);
  }

  async importGroupsBatch(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { groups } = req.body;
    if (!groups || !Array.isArray(groups)) throw new BadRequestError("Dữ liệu nhóm không hợp lệ");
    const data = await teacherService.importGroupsBatch(id, teacherId, groups);
    return ApiResponse.created(res, "Import nhóm hàng loạt thành công", data);
  }
}

export const teacherController = new TeacherController();
