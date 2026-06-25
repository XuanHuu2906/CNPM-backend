import { Router } from 'express';
import { commentController } from '../../controllers/comment.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { verifySubmissionOwnershipBy } from '../../middleware/verifySubmissionOwnership';
import { createCommentSchema } from '../../validators/comment.validator';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * B20: route /internal-notes (mount tại routes/index.ts) — chỉ dành cho GV/Admin/PĐT.
 * Sinh viên không bao giờ thấy hoặc ghi được ghi chú nội bộ này (R7).
 */

// Tạo ghi chú nội bộ → chỉ GV phụ trách lớp được phép.
router.post(
  '/submission/:submissionId',
  authenticate,
  authorize(UserRole.TEACHER),
  verifySubmissionOwnershipBy('submissionId'),
  validate(createCommentSchema),
  commentController.addComment,
);

// Xem ghi chú nội bộ → GV phụ trách, Admin, PĐT.
router.get(
  '/submission/:submissionId',
  authenticate,
  authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT),
  verifySubmissionOwnershipBy('submissionId'),
  commentController.getComments,
);

// Xoá ghi chú nội bộ → GV (chủ sở hữu) hoặc Admin.
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  commentController.deleteComment,
);

export default router;
