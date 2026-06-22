import { Router } from 'express';
import { rubricController } from '../../controllers/rubric.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { createRubricSchema } from '../../validators/rubric.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// ==========================================
// TIÊU CHÍ CHẤM ĐIỂM (RUBRICS & CRITERIA)
// ==========================================

// 1. Giảng viên / Quản trị viên thiết lập bảng Rubric và các Criteria con lồng nhau (UC-08)
router.post('/', authenticate, authorize(UserRole.TEACHER), validate(createRubricSchema), rubricController.createRubric);

// 2. Lấy toàn bộ hoặc lấy riêng các bảng Rubric của bản thân giảng viên dạy
router.get('/', authenticate, rubricController.getAllRubrics);

// 3. Xem chi tiết 1 bảng Rubric và các Criteria con lồng nhau
router.get('/:id', authenticate, rubricController.getRubricById);

// 4. Xóa bảng Rubric (bảo vệ: Chặn xóa nếu Rubric đã liên kết với điểm đã chấm)
router.delete('/:id', authenticate, authorize(UserRole.TEACHER), rubricController.deleteRubric);

export default router;
