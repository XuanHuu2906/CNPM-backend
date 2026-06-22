import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';

export class UserController {
    /**
     * Lấy thông tin hồ sơ của người dùng đăng đăng nhập (UC-02)
     */
    async getProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const profile = await userService.getUserProfile(userId);
            return ApiResponse.success(res, "Lấy thông tin hồ sơ thành công!", profile);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Cập nhật thông tin liên hệ của chính mình (UC-02)
     */
    async updateProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const { fullName, phoneNumber } = req.body;
            const result = await userService.updateUserProfile(userId, fullName, phoneNumber);
            return ApiResponse.success(res, "Cập nhật thông tin liên hệ thành công!", result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Cập nhật ảnh đại diện (avatar) cho người dùng
     */
    async updateAvatar(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file ảnh!' });
            }

            if (!req.file.mimetype.startsWith('image/')) {
                return res.status(400).json({ success: false, message: 'Chỉ chấp nhận file ảnh!' });
            }

            const result = await userService.updateUserAvatar(userId, req.file.buffer, req.file.originalname);
            return ApiResponse.success(res, "Cập nhật ảnh đại diện thành công!", result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * ADMIN: Xem danh sách toàn bộ tài khoản người dùng (UC-13)
     */
    async getAllUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const users = await userService.getAllUsers();
            return ApiResponse.success(res, "Lấy danh sách tài khoản thành công!", users);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * ADMIN: Tạo tài khoản người dùng mới thủ công (UC-13)
     */
    async createUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password, fullName, phoneNumber, role, employeeCodeOrMssv, classId, title } = req.body;
            const result = await userService.createUser({
                email,
                passwordHash: password,
                fullName,
                phoneNumber,
                role,
                employeeCodeOrMssv,
                classId,
                title,
            });
            return ApiResponse.success(res, "Tạo tài khoản người dùng mới thành công!", result, 201);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * ADMIN: Khóa/mở khóa hoặc cập nhật vai trò tài khoản (UC-13)
     */
    async updateRoleStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { role, isActive } = req.body;
            const result = await userService.updateRoleStatus(id, role, isActive);
            return ApiResponse.success(res, "Cập nhật vai trò và trạng thái tài khoản thành công!", result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * ADMIN: Cấp lại mật khẩu mới cho tài khoản người dùng (UC-13)
     */
    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { password } = req.body;
            const result = await userService.resetPassword(id, password);
            return ApiResponse.success(res, "Cấp lại mật khẩu thành công!", result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * ADMIN: Nhập hàng loạt tài khoản người dùng (UC-13)
     */
    async createUsersBatch(req: Request, res: Response, next: NextFunction) {
        try {
            const { users } = req.body;
            if (!Array.isArray(users)) {
                throw new BadRequestError("Dữ liệu danh sách tài khoản không hợp lệ.");
            }
            // S4: hạn chế kích thước batch để tránh DoS / cạn bộ nhớ
            if (users.length > 500) {
                throw new BadRequestError('Mỗi lần nhập tối đa 500 tài khoản người dùng');
            }
            const results = [];
            for (const userData of users) {
                try {
                    const created = await userService.createUser({
                        email: userData.email,
                        passwordHash: userData.password || "123456",
                        fullName: userData.fullName,
                        phoneNumber: userData.phoneNumber,
                        role: userData.role,
                        employeeCodeOrMssv: userData.employeeCodeOrMssv || userData.mssv || userData.code,
                        classId: userData.classId,
                        title: userData.title,
                    });
                    results.push({ success: true, email: userData.email, user: created });
                } catch (err: any) {
                    results.push({ success: false, email: userData.email, error: err.message });
                }
            }
            return ApiResponse.success(res, "Thực thi nhập hàng loạt hoàn tất", results);
        } catch (error) {
            return next(error);
        }
    }
}
export const userController = new UserController();
