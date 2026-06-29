import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';
import { auditLog } from '../utils/audit';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';

/**
 * Render email thông báo tài khoản mới do Admin khởi tạo.
 * Dùng cho luồng /users/batch (UC-13). MSSV/Mã GV được hiển thị theo role.
 */
function renderAdminCreatedAccountEmail(payload: {
  fullName: string;
  identifier: string;
  password: string;
  roleLabel: string;
}): string {
  const { fullName, identifier, password, roleLabel } = payload;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #4F46E5; margin-bottom: 8px;">Chào ${fullName},</h2>
      <p>Quản trị viên đã khởi tạo tài khoản <b>${roleLabel}</b> cho bạn trên Hệ thống Chấm điểm Báo cáo.</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 8px;"><b>Mã định danh:</b> <code style="background:#fff;padding:2px 8px;border-radius:4px;">${identifier}</code></p>
        <p style="margin:0;"><b>Mật khẩu tạm thời:</b> <code style="background:#fff;padding:2px 8px;border-radius:4px;">${password}</code></p>
      </div>
      <p style="color:#b91c1c;font-weight:bold;">Lưu ý: Bạn bắt buộc phải đổi mật khẩu trong lần đăng nhập đầu tiên.</p>
      <p>Trân trọng,<br/>Quản trị hệ thống</p>
    </div>
  `;
}

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
            // UC-I04: ghi audit
            await auditLog(req.user?.id ?? null, 'TAO_TAI_KHOAN', `Tạo tài khoản ${email} (role=${role})`, req.ip);
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
            // UC-I04: ghi audit
            await auditLog(req.user?.id ?? null, 'CAP_NHAT_VAI_TRO', `Cập nhật tài khoản ${id} → role=${role}, isActive=${isActive}`, req.ip);
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
            // UC-I04: ghi audit (KHÔNG log mật khẩu)
            await auditLog(req.user?.id ?? null, 'RESET_MAT_KHAU_ADMIN', `Reset mật khẩu cho tài khoản ${id}`, req.ip);
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
            const results: any[] = [];
            // Thu thập plaintext credential cho các tài khoản STUDENT/TEACHER mới tạo để gửi mail sau (best-effort).
            const toEmail: { email: string; fullName: string; identifier: string; password: string; role: string }[] = [];
            for (const userData of users) {
                const plainPassword = userData.password || "123456";
                const identifier = userData.employeeCodeOrMssv || userData.mssv || userData.code;
                try {
                    const created = await userService.createUser({
                        email: userData.email,
                        passwordHash: plainPassword,
                        fullName: userData.fullName,
                        phoneNumber: userData.phoneNumber,
                        role: userData.role,
                        employeeCodeOrMssv: identifier,
                        classId: userData.classId,
                        title: userData.title,
                    });
                    results.push({ success: true, email: userData.email, user: created });
                    if (userData.role === 'STUDENT' || userData.role === 'TEACHER') {
                        toEmail.push({
                            email: userData.email,
                            fullName: userData.fullName,
                            identifier,
                            password: plainPassword,
                            role: userData.role,
                        });
                    }
                } catch (err: any) {
                    results.push({ success: false, email: userData.email, error: err.message });
                }
            }
            const successCount = results.filter((r) => r.success).length;

            // Gửi mail credential best-effort cho STUDENT/TEACHER. Lỗi mail không làm fail import.
            let emailSentCount = 0;
            for (const item of toEmail) {
                try {
                    const roleLabel = item.role === 'STUDENT' ? 'Sinh viên' : 'Giảng viên';
                    const html = renderAdminCreatedAccountEmail({
                        fullName: item.fullName,
                        identifier: item.identifier,
                        password: item.password,
                        roleLabel,
                    });
                    const sent = await emailService.sendEmail(
                        item.email,
                        'Tài khoản hệ thống Chấm điểm Báo cáo của bạn',
                        html,
                        item.role === 'STUDENT' ? 'STUDENT_ACCOUNT_CREATED' : 'TEACHER_ACCOUNT_CREATED',
                        `${item.role.toLowerCase()}-account-${item.identifier}`,
                    );
                    if (sent) emailSentCount++;
                    else logger.warn(`Không gửi được mail tài khoản cho ${item.email} (${item.identifier})`);
                } catch (mailErr: any) {
                    logger.error(`Lỗi gửi mail credential cho ${item.email}: ${mailErr.message}`);
                }
            }

            // UC-I04: ghi audit batch import tài khoản
            await auditLog(
                req.user?.id ?? null,
                'IMPORT_TAI_KHOAN_BATCH',
                `Admin import batch ${users.length} tài khoản (thành công ${successCount}/${users.length}, gửi mail ${emailSentCount}/${toEmail.length})`,
                req.ip,
            );
            return ApiResponse.success(res, "Thực thi nhập hàng loạt hoàn tất", {
                results,
                emailEligibleCount: toEmail.length,
                emailSentCount,
            });
        } catch (error) {
            return next(error);
        }
    }
}
export const userController = new UserController();
