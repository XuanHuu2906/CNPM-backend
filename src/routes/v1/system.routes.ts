import { Router } from 'express';
import { systemController } from '../../controllers/system.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { approveGradeSchema, updateConfigSchema, restoreDbSchema } from '../../validators/system.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// ==========================================
// HỆ THỐNG VÀ QUẢN TRỊ (SYSTEM)
// ==========================================

// 1. PDT / Admin phê duyệt hoặc gỡ phê duyệt bảng điểm kèm OCC (UC-16)
router.put('/grades/:submissionId/approve', authenticate, authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN), validate(approveGradeSchema), systemController.approveGrade);

// 2. Admin cập nhật tham số cấu hình hệ thống (UC-14)
router.put('/configs', authenticate, authorize(UserRole.ADMIN), validate(updateConfigSchema), systemController.updateConfig);

// 3. Đăng nhập xem danh sách cấu hình hệ thống
router.get('/configs', authenticate, systemController.getConfigs);

// 3.1. Tìm kiếm toàn cục hệ thống (Đề tài, nhóm, bài báo cáo, giảng viên)
router.get('/search', authenticate, systemController.search);

// 4. Admin xem nhật ký lịch sử hoạt động hệ thống phân trang (UC-21)
router.get('/logs', authenticate, authorize(UserRole.ADMIN), systemController.getLogs);

// 5. Admin sao lưu toàn bộ cơ sở dữ liệu thành tệp tin JSON (UC-20)
router.post('/backup', authenticate, authorize(UserRole.ADMIN), systemController.backupDb);

// 6. Admin khôi phục cơ sở dữ liệu từ tệp tin JSON sao lưu (UC-20)
router.post('/restore', authenticate, authorize(UserRole.ADMIN), validate(restoreDbSchema), systemController.restoreDb);

// 7. Admin xem danh sách các tệp sao lưu hiện có
router.get('/backups', authenticate, authorize(UserRole.ADMIN), systemController.listBackups);

// 8. Admin xóa một tệp sao lưu chỉ định
router.delete('/backups/:filename', authenticate, authorize(UserRole.ADMIN), systemController.deleteBackup);

// 8.1 Admin tải xuống một tệp sao lưu chỉ định
router.get('/backups/:filename/download', authenticate, authorize(UserRole.ADMIN), systemController.downloadBackup);

// 9. Lấy thống kê trạng thái phê duyệt & khóa điểm học kỳ
router.get('/semesters/:id/lock-stats', authenticate, authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN), systemController.getSemesterLockStats);

// 9.5. Lấy thống kê tiến độ học kỳ (UC-18)
router.get('/semesters/:id/progress', authenticate, authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN), systemController.getSemesterProgress);

// 10. Admin thực hiện đóng băng kết quả học kỳ
router.post('/semesters/:id/lock', authenticate, authorize(UserRole.ADMIN), systemController.lockSemester);

export default router;
