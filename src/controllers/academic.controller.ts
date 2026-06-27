import { Request, Response } from 'express';
import { academicService } from '../services/academic.service';
import { ApiResponse, BadRequestError, UnauthorizedError } from '../utils/apiResponse';
import { auditLog } from '../utils/audit';

export class AcademicController {
  // ==========================================
  // ACADEMIC TERM (HỌC KỲ)
  // ==========================================

  async createTerm(req: Request, res: Response) {
    const term = await academicService.createTerm(req.body);
    await auditLog(
      req.user?.id ?? null,
      'TAO_HOC_KY',
      `Tạo học kỳ "${(term as any)?.name ?? req.body?.name ?? ''}"`,
      req.ip,
    );
    return ApiResponse.created(res, "Tạo mới học kỳ thành công", term);
  }

  async getAllTerms(req: Request, res: Response) {
    const terms = await academicService.getAllTerms();
    return ApiResponse.success(res, "Lấy danh sách học kỳ thành công", terms);
  }

  async updateTerm(req: Request, res: Response) {
    const { id } = req.params;
    const term = await academicService.updateTerm(id, req.body);
    await auditLog(
      req.user?.id ?? null,
      'CAP_NHAT_HOC_KY',
      `Cập nhật học kỳ ${id}`,
      req.ip,
    );
    return ApiResponse.success(res, "Cập nhật học kỳ thành công", term);
  }

  // ==========================================
  // SUBJECT (MÔN HỌC)
  // ==========================================

  async createSubject(req: Request, res: Response) {
    const subject = await academicService.createSubject(req.body);
    await auditLog(
      req.user?.id ?? null,
      'TAO_MON_HOC',
      `Tạo môn học "${(subject as any)?.name ?? req.body?.name ?? ''}"`,
      req.ip,
    );
    return ApiResponse.created(res, "Tạo mới môn học thành công", subject);
  }

  async getAllSubjects(req: Request, res: Response) {
    const subjects = await academicService.getAllSubjects();
    return ApiResponse.success(res, "Lấy danh sách môn học thành công", subjects);
  }

  // ==========================================
  // CLASS (LỚP HỌC PHẦN)
  // ==========================================

  async getAllClasses(req: Request, res: Response) {
    const classes = await academicService.getAllClasses();
    return ApiResponse.success(res, "Lấy danh sách lớp học phần thành công", classes);
  }

  async getClassById(req: Request, res: Response) {
    const { id } = req.params;
    const clazz = await academicService.getClassById(id);
    return ApiResponse.success(res, "Lấy chi tiết lớp học phần thành công", clazz);
  }

  // ==========================================
  // ASSIGNMENT (PHÂN CÔNG GIẢNG DẠY)
  // ==========================================

  async assignTeacher(req: Request, res: Response) {
    const assignment = await academicService.assignTeacher(req.body);
    await auditLog(
      req.user?.id ?? null,
      'PHAN_CONG_GV',
      `PĐT phân công GV ${req.body?.teacherId ?? '?'} vào lớp ${req.body?.classId ?? '?'}`,
      req.ip,
    );
    return ApiResponse.created(res, "Phân công giảng dạy thành công", assignment);
  }

  async unassignTeacher(req: Request, res: Response) {
    const { classId, teacherId } = req.params;
    const assignment = await academicService.unassignTeacher(classId, teacherId);
    await auditLog(
      req.user?.id ?? null,
      'HUY_PHAN_CONG_GV',
      `PĐT hủy phân công GV ${teacherId} khỏi lớp ${classId}`,
      req.ip,
    );
    return ApiResponse.success(res, "Hủy phân công giảng dạy thành công", assignment);
  }

  // UC-17: Đổi GV phụ trách lớp giữa kỳ (1 cú gọi, ghi LichSuPhanCong, giữ điểm nháp)
  async changeClassTeacher(req: Request, res: Response) {
    const { classId } = req.params;
    const { newTeacherId, reason } = req.body;
    const actorId = req.user?.id;
    if (!actorId) {
      throw new UnauthorizedError();
    }
    const result = await academicService.changeClassTeacher({ classId, newTeacherId, reason, actorId });
    await auditLog(
      actorId,
      'THAY_DOI_GV_PHU_TRACH',
      `PĐT đổi GV phụ trách lớp ${result.classCode}: ${result.oldTeacherId} → ${result.newTeacherId} (bài đang dở: ${result.inProgressCount}). Lý do: ${reason}`,
      req.ip,
    );
    return ApiResponse.success(res, 'Đổi giảng viên phụ trách thành công', result);
  }

  async getClassAssignmentHistory(req: Request, res: Response) {
    const { classId } = req.params;
    const histories = await academicService.getClassAssignmentHistory(classId);
    return ApiResponse.success(res, 'Lịch sử thay đổi giảng viên phụ trách', histories);
  }

  // ==========================================
  // BATCH IMPORTS (NHẬP HÀNG LOẠT)
  // ==========================================

  async createTermsBatch(req: Request, res: Response) {
    const { terms } = req.body;
    if (!Array.isArray(terms)) {
      return res.status(400).json({ success: false, message: "Dữ liệu danh sách học kỳ không hợp lệ." });
    }
    const results = await academicService.createTermsBatch(terms);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_HOC_KY_BATCH',
      `Import batch ${terms.length} học kỳ`,
      req.ip,
    );
    return ApiResponse.success(res, "Thực thi nhập học kỳ hàng loạt hoàn tất", results);
  }

  async createClassesBatch(req: Request, res: Response) {
    const { classes } = req.body;
    if (!Array.isArray(classes)) {
      return res.status(400).json({ success: false, message: "Dữ liệu danh sách lớp học phần không hợp lệ." });
    }
    const results = await academicService.createClassesBatch(classes);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_LOP_HOC_PHAN_BATCH',
      `Import batch ${classes.length} lớp học phần`,
      req.ip,
    );
    return ApiResponse.success(res, "Thực thi nhập lớp học phần hàng loạt hoàn tất", results);
  }

  async setClassAssignmentType(req: Request, res: Response) {
    const { id } = req.params;
    const { value } = req.body ?? {};
    if (typeof value !== 'string') {
      throw new BadRequestError('Giá trị loại phân công không hợp lệ');
    }
    const updated = await academicService.setClassAssignmentType(id, value);
    await auditLog(
      req.user?.id ?? null,
      'UPDATE_LOAI_PHAN_CONG',
      `Đổi loại phân công lớp ${updated.classCode} -> ${updated.assignmentType}`,
      req.ip,
    );
    return ApiResponse.success(res, 'Cập nhật loại phân công thành công', updated);
  }

  async importClassExcel(req: Request, res: Response) {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer) throw new BadRequestError('Vui lòng tải lên file Excel (.xlsx)');
    const data = await academicService.importClassFromExcel(file.buffer);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_LOP_EXCEL',
      `PĐT tạo lớp ${data.class.classCode} (GV ${data.teacher.teacherCode}, ${data.studentCount} SV, ${data.createdUsersCount} SV mới) từ file ${file.originalname}`,
      req.ip,
    );
    return ApiResponse.created(res, 'Tạo lớp từ Excel thành công', data);
  }

  async bulkImportStudents(req: Request, res: Response) {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer) throw new BadRequestError('Vui lòng tải lên file Excel (.xlsx)');
    const data = await academicService.bulkImportStudents(file.buffer);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_SV_BATCH',
      `PĐT import ${data.totalRows} SV từ file ${file.originalname} (mới: ${data.createdCount}, bỏ qua: ${data.skippedCount}, lỗi: ${data.failedCount}, mail gửi: ${data.emailSentCount})`,
      req.ip,
    );
    return ApiResponse.created(res, 'Nhập danh sách sinh viên hoàn tất', data);
  }

  async createEnrollmentsBatch(req: Request, res: Response) {
    const { enrollments } = req.body;
    if (!Array.isArray(enrollments)) {
      return res.status(400).json({ success: false, message: "Dữ liệu danh sách đăng ký lớp không hợp lệ." });
    }
    const results = await academicService.createEnrollmentsBatch(enrollments);
    await auditLog(
      req.user?.id ?? null,
      'IMPORT_DANG_KY_LOP_BATCH',
      `Import batch ${enrollments.length} đăng ký lớp`,
      req.ip,
    );
    return ApiResponse.success(res, "Thực thi nhập đăng ký lớp hàng loạt hoàn tất", results);
  }
}

export const academicController = new AcademicController();
