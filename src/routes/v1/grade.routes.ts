import { Router } from 'express';
import { gradeController } from '../../controllers/grade.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { verifySubmissionOwnershipBy } from '../../middleware/verifySubmissionOwnership';
import { submitGradeSchema } from '../../validators/grade.validator';
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

export default router;
