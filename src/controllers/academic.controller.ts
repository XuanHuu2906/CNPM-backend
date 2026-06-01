import { Request, Response } from 'express';
import { academicService } from '../services/academic.service';
import { ApiResponse } from '../utils/apiResponse';

export class AcademicController {
  // ==========================================
  // ACADEMIC TERM (HỌC KỲ)
  // ==========================================

  async createTerm(req: Request, res: Response) {
    const term = await academicService.createTerm(req.body);
    return ApiResponse.created(res, "Tạo mới học kỳ thành công", term);
  }

  async getAllTerms(req: Request, res: Response) {
    const terms = await academicService.getAllTerms();
    return ApiResponse.success(res, "Lấy danh sách học kỳ thành công", terms);
  }

  async updateTerm(req: Request, res: Response) {
    const { id } = req.params;
    const term = await academicService.updateTerm(id, req.body);
    return ApiResponse.success(res, "Cập nhật học kỳ thành công", term);
  }

  // ==========================================
  // SUBJECT (MÔN HỌC)
  // ==========================================

  async createSubject(req: Request, res: Response) {
    const subject = await academicService.createSubject(req.body);
    return ApiResponse.created(res, "Tạo mới môn học thành công", subject);
  }

  async getAllSubjects(req: Request, res: Response) {
    const subjects = await academicService.getAllSubjects();
    return ApiResponse.success(res, "Lấy danh sách môn học thành công", subjects);
  }

  // ==========================================
  // CLASS (LỚP HỌC PHẦN)
  // ==========================================

  async createClass(req: Request, res: Response) {
    const clazz = await academicService.createClass(req.body);
    return ApiResponse.created(res, "Tạo mới lớp học phần thành công", clazz);
  }

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
    return ApiResponse.created(res, "Phân công giảng dạy thành công", assignment);
  }

  async unassignTeacher(req: Request, res: Response) {
    const { classId, teacherId } = req.params;
    const assignment = await academicService.unassignTeacher(classId, teacherId);
    return ApiResponse.success(res, "Hủy phân công giảng dạy thành công", assignment);
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
    return ApiResponse.success(res, "Thực thi nhập học kỳ hàng loạt hoàn tất", results);
  }

  async createClassesBatch(req: Request, res: Response) {
    const { classes } = req.body;
    if (!Array.isArray(classes)) {
      return res.status(400).json({ success: false, message: "Dữ liệu danh sách lớp học phần không hợp lệ." });
    }
    const results = await academicService.createClassesBatch(classes);
    return ApiResponse.success(res, "Thực thi nhập lớp học phần hàng loạt hoàn tất", results);
  }

  async createEnrollmentsBatch(req: Request, res: Response) {
    const { enrollments } = req.body;
    if (!Array.isArray(enrollments)) {
      return res.status(400).json({ success: false, message: "Dữ liệu danh sách đăng ký lớp không hợp lệ." });
    }
    const results = await academicService.createEnrollmentsBatch(enrollments);
    return ApiResponse.success(res, "Thực thi nhập đăng ký lớp hàng loạt hoàn tất", results);
  }
}

export const academicController = new AcademicController();
