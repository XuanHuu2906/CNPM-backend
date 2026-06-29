import { Router } from 'express';
import { gradeAppealController } from '../../controllers/grade-appeal.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// ==========================================
// YÊU CẦU PHÚC KHẢO ĐIỂM (UC-25)
// ==========================================

// 1. SV gửi phúc khảo (1 lần / submission, trong vòng 14 ngày kể từ HOAN_THANH)
router.post(
  '/:submissionId',
  authenticate,
  authorize(UserRole.STUDENT),
  gradeAppealController.createAppeal.bind(gradeAppealController),
);

// 2. SV xem danh sách phúc khảo của mình
router.get(
  '/my',
  authenticate,
  authorize(UserRole.STUDENT),
  gradeAppealController.getMyAppeals.bind(gradeAppealController),
);

// 3. PĐT / Admin xem danh sách
router.get(
  '/',
  authenticate,
  authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN),
  gradeAppealController.listForAcademic.bind(gradeAppealController),
);

// 3b. PĐT / Admin chủ động tạo yêu cầu phúc khảo (thay cho "trả về chấm lại")
router.post(
  '/academic/:submissionId',
  authenticate,
  authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN),
  gradeAppealController.createAppealByAcademic.bind(gradeAppealController),
);

// 4. PĐT / Admin duyệt
router.patch(
  '/:id/approve',
  authenticate,
  authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN),
  gradeAppealController.approveAppeal.bind(gradeAppealController),
);

// 5. PĐT / Admin từ chối
router.patch(
  '/:id/reject',
  authenticate,
  authorize(UserRole.ACADEMIC_DEPT, UserRole.ADMIN),
  gradeAppealController.rejectAppeal.bind(gradeAppealController),
);

export default router;
