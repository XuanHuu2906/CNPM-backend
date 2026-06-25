import { Request, Response } from 'express';
import { teacherService } from '../services/teacher.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';
import { auditLog } from '../utils/audit';

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
    await auditLog(
      req.user?.id ?? null,
      'TAO_NHOM',
      `GV tạo nhóm "${name}" trong lớp ${id}`,
      req.ip,
    );
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

    await auditLog(
      req.user?.id ?? null,
      'CAP_NHAT_NHOM',
      `GV cập nhật nhóm ${id}` + (name !== undefined ? ` name="${name}"` : '') + (topicName !== undefined ? ` topic="${topicName}"` : ''),
      req.ip,
    );
    return ApiResponse.success(res, "Cập nhật nhóm thành công", result);
  }

  async deleteGroup(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    await teacherService.deleteGroup(id, teacherId);
    await auditLog(
      req.user?.id ?? null,
      'XOA_NHOM',
      `GV xoá nhóm ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, "Xóa nhóm thành công");
  }

  async addMember(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { studentId } = req.body;
    if (!studentId) throw new BadRequestError("Mã sinh viên không được để trống");
    const data = await teacherService.addMember(id, teacherId, studentId);
    await auditLog(
      req.user?.id ?? null,
      'THEM_THANH_VIEN_NHOM',
      `GV thêm SV ${studentId} vào nhóm ${id}`,
      req.ip,
    );
    return ApiResponse.created(res, "Thêm thành viên thành công", data);
  }

  async removeMember(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id, studentId } = req.params;
    await teacherService.removeMember(id, teacherId, studentId);
    await auditLog(
      req.user?.id ?? null,
      'GO_THANH_VIEN_NHOM',
      `GV gỡ SV ${studentId} khỏi nhóm ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, "Gỡ thành viên thành công");
  }

  async updateTopic(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { topicName } = req.body;
    const data = await teacherService.updateGroupTopic(id, teacherId, topicName);
    await auditLog(
      req.user?.id ?? null,
      'GIAO_DE_TAI',
      `GV cập nhật đề tài nhóm ${id}: "${topicName ?? ''}"`,
      req.ip,
    );
    return ApiResponse.success(res, "Cập nhật đề tài thành công", data);
  }

  async autoGenerateGroups(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { targetSize } = req.body;
    if (!targetSize || targetSize < 1) throw new BadRequestError("Kích cỡ nhóm phải >= 1");
    const data = await teacherService.autoGenerateGroups(id, teacherId, targetSize);
    await auditLog(
      req.user?.id ?? null,
      'TU_DONG_CHIA_NHOM',
      `GV tự động chia nhóm lớp ${id} (size=${targetSize})`,
      req.ip,
    );
    return ApiResponse.created(res, "Tự động chia nhóm thành công", data);
  }

  async importGroupsBatch(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const { groups } = req.body;
    if (!groups || !Array.isArray(groups)) throw new BadRequestError("Dữ liệu nhóm không hợp lệ");
    const data = await teacherService.importGroupsBatch(id, teacherId, groups);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_NHOM_BATCH',
      `GV import ${groups.length} nhóm vào lớp ${id}`,
      req.ip,
    );
    return ApiResponse.created(res, "Import nhóm hàng loạt thành công", data);
  }

  // UC-16: GV gửi duyệt cả lớp.
  async submitClassForReview(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const userId = req.user!.id;
    const { id } = req.params;
    const data = await teacherService.submitClassForReview(id, teacherId, userId);
    await auditLog(
      userId,
      'GV_GUI_DUYET_CA_LOP',
      `GV gửi duyệt cả lớp ${id}: chuyển ${data.movedCount} bài sang CHO_DUYET (bỏ qua ${data.skippedCount}, lỗi ${data.failedCount})`,
      req.ip,
    );
    return ApiResponse.success(res, 'Đã gửi duyệt các bài đã chấm xong của lớp', data);
  }

  async importGroupsExcel(req: Request, res: Response) {
    const teacherId = req.user!.actorId!;
    const { id } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer) throw new BadRequestError("Vui lòng tải lên file Excel (.xlsx)");
    const data = await teacherService.importGroupsFromExcel(id, teacherId, file.buffer);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_NHOM_EXCEL',
      `GV import ${data.groupCount} nhóm (${data.memberCount} SV, ${data.createdUsersCount} SV mới) vào lớp ${id} từ file ${file.originalname}`,
      req.ip,
    );
    return ApiResponse.created(res, "Import nhóm từ Excel thành công", data);
  }
}

export const teacherController = new TeacherController();
