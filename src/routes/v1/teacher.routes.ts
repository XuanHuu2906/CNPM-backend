import { Router } from 'express';
import multer from 'multer';
import { teacherController } from '../../controllers/teacher.controller';
import { gradeController } from '../../controllers/grade.controller';
import { reopenRequestController } from '../../controllers/reopen-request.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Tất cả route dành cho TEACHER
const teacherAuth = [authenticate, authorize(UserRole.TEACHER)];

// Multer in-memory upload cho file Excel danh sách phân công đề tài
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// 1. Danh sách LHP được phân công
router.get('/class-sections', ...teacherAuth, teacherController.getClassSections);

// 2. Danh sách SV trong LHP
router.get('/class-sections/:id/students', ...teacherAuth, teacherController.getStudents);

// 3. Danh sách nhóm trong LHP
router.get('/class-sections/:id/groups', ...teacherAuth, teacherController.getGroups);

// 4. Tạo nhóm mới
router.post('/class-sections/:id/groups', ...teacherAuth, teacherController.createGroup);

// 5. Tự động chia nhóm
router.post('/class-sections/:id/groups/auto-generate', ...teacherAuth, teacherController.autoGenerateGroups);

// 5.5. Import nhóm từ JSON (FE đã parse sẵn — flow cũ)
router.post('/class-sections/:id/groups/import', ...teacherAuth, teacherController.importGroupsBatch);

// 5.6. Import nhóm + nhóm trưởng từ file Excel (BE parse, detect màu đỏ = leader)
router.post(
  '/class-sections/:id/groups/import-excel',
  ...teacherAuth,
  excelUpload.single('file'),
  teacherController.importGroupsExcel,
);

// 6. Sửa nhóm (tên / đề tài)
router.patch('/groups/:id', ...teacherAuth, teacherController.updateGroup);

// 7. Xóa nhóm
router.delete('/groups/:id', ...teacherAuth, teacherController.deleteGroup);

// 8. Thêm thành viên vào nhóm
router.post('/groups/:id/members', ...teacherAuth, teacherController.addMember);

// 9. Gỡ thành viên khỏi nhóm
router.delete('/groups/:id/members/:studentId', ...teacherAuth, teacherController.removeMember);

// 10. Cập nhật đề tài nhóm
router.patch('/groups/:id/topic', ...teacherAuth, teacherController.updateTopic);

// 10.5 UC-16: GV gửi duyệt cả lớp (DA_CHAM → CHO_DUYET hàng loạt).
router.post('/class-sections/:id/submit-for-review', ...teacherAuth, teacherController.submitClassForReview);

// --- Yêu Cầu Mở Lại Chấm Điểm ---
router.post('/submissions/:submissionId/reopen-request', ...teacherAuth, reopenRequestController.createRequest.bind(reopenRequestController));

export default router;
