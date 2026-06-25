import { Router } from 'express';
import multer from 'multer';
import { academicController } from '../../controllers/academic.controller';
import { reopenRequestController } from '../../controllers/reopen-request.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import {
  createTermSchema,
  updateTermSchema,
  createSubjectSchema,
  assignTeacherSchema,
  changeClassTeacherSchema,
} from '../../validators/academic.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// Multer in-memory upload cho file Excel template lớp học phần
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ==========================================
// HỌC KỲ (ACADEMIC TERMS)
// ==========================================

// 1. Tạo mới học kỳ (PDT/Admin) (UC-19)
router.post('/terms', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(createTermSchema), academicController.createTerm);

// 2. Lấy toàn bộ học kỳ (Đăng nhập là xem được)
router.get('/terms', authenticate, academicController.getAllTerms);

// 3. Khóa/Mở khóa học kỳ hoặc cập nhật học kỳ (PDT/Admin) (UC-19)
router.put('/terms/:id', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(updateTermSchema), academicController.updateTerm);

// ==========================================
// MÔN HỌC (SUBJECTS)
// ==========================================

// 4. Tạo môn học mới (PDT/Admin) (UC-13)
router.post('/subjects', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(createSubjectSchema), academicController.createSubject);

// 5. Xem danh sách môn học
router.get('/subjects', authenticate, academicController.getAllSubjects);

// ==========================================
// LỚP HỌC PHẦN (CLASSES)
// ==========================================

// 6. Lấy danh sách lớp học phần
router.get('/classes', authenticate, academicController.getAllClasses);

// 7. Lấy chi tiết lớp học phần
router.get('/classes/:id', authenticate, academicController.getClassById);

// ==========================================
// PHÂN CÔNG GIẢNG DẠY (TEACHER ASSIGNMENTS)
// ==========================================

// 9. Phân công giảng viên cho lớp (PDT/Admin) (UC-13)
router.post('/assignments', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(assignTeacherSchema), academicController.assignTeacher);

// 10. Hủy phân công giảng viên dạy lớp (PDT/Admin)
router.delete('/assignments/:classId/:teacherId', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), academicController.unassignTeacher);

// 10.1 UC-17: Đổi GV phụ trách lớp giữa kỳ (1 thao tác, kèm lý do bắt buộc).
router.put(
  '/classes/:classId/teacher',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT),
  validate(changeClassTeacherSchema),
  academicController.changeClassTeacher,
);

// 10.2 UC-17: Lịch sử thay đổi GV phụ trách của lớp.
router.get(
  '/classes/:classId/assignment-history',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT),
  academicController.getClassAssignmentHistory,
);

// ==========================================
// BATCH IMPORTS (NHẬP HÀNG LOẠT) — chỉ PĐT, Admin chỉ làm kỹ thuật
// ==========================================

// 11. Nhập học kỳ hàng loạt
router.post('/terms/batch', authenticate, authorize(UserRole.ACADEMIC_DEPT), academicController.createTermsBatch);

// 12. Nhập lớp học phần hàng loạt
router.post('/classes/batch', authenticate, authorize(UserRole.ACADEMIC_DEPT), academicController.createClassesBatch);

// 13. Nhập đăng ký lớp hàng loạt
router.post('/enrollments/batch', authenticate, authorize(UserRole.ACADEMIC_DEPT), academicController.createEnrollmentsBatch);

// 13.5. Import 1 lớp học phần từ file Excel (PĐT upload — 1 file = 1 lớp)
router.post(
  '/classes/import-excel',
  authenticate,
  authorize(UserRole.ACADEMIC_DEPT),
  excelUpload.single('file'),
  academicController.importClassExcel,
);

// 13.6. Import danh sách sinh viên hàng loạt + gửi mail tài khoản (PĐT)
router.post(
  '/students/bulk-import',
  authenticate,
  authorize(UserRole.ACADEMIC_DEPT),
  excelUpload.single('file'),
  academicController.bulkImportStudents,
);

// ==========================================
// YÊU CẦU MỞ LẠI CHẤM ĐIỂM
// ==========================================

// 14. Lấy danh sách yêu cầu
router.get('/grading-reopen-requests', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), reopenRequestController.getRequests.bind(reopenRequestController));

// 15. Duyệt yêu cầu
router.patch('/grading-reopen-requests/:id/approve', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), reopenRequestController.approveRequest.bind(reopenRequestController));

// 16. Từ chối yêu cầu
router.patch('/grading-reopen-requests/:id/reject', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), reopenRequestController.rejectRequest.bind(reopenRequestController));

export default router;
