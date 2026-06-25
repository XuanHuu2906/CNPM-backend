import { Router } from 'express';
import { gradeController } from '../../controllers/grade.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { verifySubmissionOwnershipBy } from '../../middleware/verifySubmissionOwnership';
import { submitGradeSchema, memberAdjustmentsSchema } from '../../validators/grade.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// ==========================================
// ĐIỂM CHẤM CHI TIẾT (GRADES)
// ==========================================

// 1. Giảng viên thực hiện chấm điểm bài báo cáo theo Rubric (UC-11, UC-I05)
router.post('/submission/:submissionId', authenticate, authorize(UserRole.TEACHER), validate(submitGradeSchema), gradeController.submitGrade);

// 2. Xem chi tiết điểm số thành phần và tổng kết của bài nộp.
// B1: chặn IDOR — SV chỉ thấy bài mình/nhóm mình; GV chỉ thấy bài thuộc lớp được phân công.
router.get('/submission/:submissionId', authenticate, verifySubmissionOwnershipBy('submissionId'), gradeController.getGradeBySubmissionId);

// 3. UC-09 / UC-I05 EXT: GV điều chỉnh hệ số đóng góp của từng thành viên trong nhóm.
router.put(
  '/submission/:submissionId/member-adjustments',
  authenticate,
  authorize(UserRole.TEACHER),
  validate(memberAdjustmentsSchema),
  gradeController.setMemberAdjustments,
);

// 4. Đọc bảng điểm chi tiết kèm điểm cá nhân từng thành viên (group score × hệ số).
router.get(
  '/submission/:submissionId/with-adjustments',
  authenticate,
  verifySubmissionOwnershipBy('submissionId'),
  gradeController.getGradeWithMemberScores,
);

export default router;
