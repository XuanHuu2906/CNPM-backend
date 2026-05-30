import { Router } from 'express';
import { groupController } from '../../controllers/group.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { createGroupSchema, updateTopicSchema, updateMembersSchema } from '../../validators/group.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// ==========================================
// ĐĂNG KÝ ĐỀ TÀI & LẬP NHÓM (GROUPS & TOPICS)
// ==========================================

// 1. Thành lập nhóm và đăng ký đề tài ban đầu (Sinh viên tự lập hoặc Giáo viên tạo giúp) (UC-05, UC-06)
router.post('/', authenticate, authorize(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(createGroupSchema), groupController.createGroup);

// 2. Lấy danh sách toàn bộ các nhóm đề tài thuộc về 1 lớp học phần cụ thể
router.get('/class/:classId', authenticate, groupController.getGroupsByClassId);

// 3. Xem chi tiết thông tin và thành viên 1 nhóm đề tài
router.get('/:id', authenticate, groupController.getGroupById);

// 4. Sinh viên hoặc Giảng viên cập nhật/sửa đổi tên đề tài nghiên cứu (UC-06, UC-07)
router.put('/:id/topic', authenticate, authorize(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(updateTopicSchema), groupController.updateTopic);

// 5. Giảng viên hoặc Quản trị viên thay đổi/điều phối danh sách thành viên trong nhóm (UC-07)
router.put('/:id/members', authenticate, authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(updateMembersSchema), groupController.updateMembers);

export default router;
