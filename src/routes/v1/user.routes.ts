import { Router } from 'express';
import { userController } from '../../controllers/user.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { updateProfileSchema, createUserSchema, updateRoleStatusSchema } from '../../validators/user.validator';
import { UserRole } from '@prisma/client';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ==========================================
// THÔNG TIN CÁ NHÂN (TẤT CẢ TÀI KHOẢN ĐÃ ĐĂNG NHẬP)
// ==========================================

// 1. Lấy thông tin hồ sơ của chính mình (UC-02)
router.get('/profile', authenticate, userController.getProfile);

// 2. Cập nhật thông tin liên lạc cá nhân (UC-02)
router.put('/profile', authenticate, validate(updateProfileSchema), userController.updateProfile);

// 3. Cập nhật ảnh đại diện (avatar)
router.put('/profile/avatar', authenticate, upload.single('avatar'), userController.updateAvatar);

// ==========================================
// QUẢN TRỊ TÀI KHOẢN (CHỈ DÀNH CHO ADMIN)
// ==========================================

// 3. Xem danh sách tài khoản toàn hệ thống (UC-13)
router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), userController.getAllUsers);

// 4. Tạo tài khoản người dùng mới thủ công (UC-13)
router.post('/', authenticate, authorize(UserRole.ADMIN), validate(createUserSchema), userController.createUser);

// 5. Khóa/mở khóa hoặc cập nhật vai trò người dùng (UC-13)
router.put('/:id/role-status', authenticate, authorize(UserRole.ADMIN), validate(updateRoleStatusSchema), userController.updateRoleStatus);

// 6. Admin cấp lại mật khẩu cho tài khoản người dùng
router.put('/:id/reset-password', authenticate, authorize(UserRole.ADMIN), userController.resetPassword);

// 7. Admin nhập hàng loạt người dùng
router.post('/batch', authenticate, authorize(UserRole.ADMIN), userController.createUsersBatch);

export default router;

