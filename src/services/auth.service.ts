import { userRepository } from '../repositories/user.repository';
import { passwordResetRepository } from '../repositories/password-reset.repository';
import { SecurityHelper } from '../utils/securityHelper';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../utils/apiResponse';

export class AuthService {
  /**
   * Đăng nhập hệ thống & cấp JWT Token
   */
  async login(email: string, password: string) {
    // 1. Tìm tài khoản người dùng
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError("Email hoặc mật khẩu không chính xác.");
    }

    // 2. Kiểm tra trạng thái hoạt động của tài khoản
    if (!user.isActive) {
      throw new UnauthorizedError("Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.");
    }

    // 3. Kiểm duyệt mật khẩu
    const isPasswordMatch = await SecurityHelper.comparePassword(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedError("Email hoặc mật khẩu không chính xác.");
    }

    // 4. Xác định mã diễn viên thực tế (actorId)
    let actorId = '';
    if (user.student) actorId = user.student.id;
    else if (user.teacher) actorId = user.teacher.id;
    else if (user.academicDept) actorId = user.academicDept.id;
    else if (user.admin) actorId = user.admin.id;

    // 5. Sinh token ký số
    const token = SecurityHelper.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        actorId,
        // UC-13: FE đọc cờ này để buộc redirect sang /change-password trước khi cho thao tác tiếp.
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Đổi mật khẩu cá nhân
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Người dùng không tồn tại hoặc phiên hết hạn.");
    }

    const isPasswordMatch = await SecurityHelper.comparePassword(oldPassword, user.password);
    if (!isPasswordMatch) {
      throw new BadRequestError("Mật khẩu cũ không chính xác.");
    }

    const passwordHash = await SecurityHelper.hashPassword(newPassword);
    // UC-13: xóa cờ buộc đổi mật khẩu sau khi đã đổi thành công.
    await userRepository.updatePassword(userId, passwordHash, false);

    return true;
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Không tiết lộ user có tồn tại hay không
      return { message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.' };
    }

    // Vô hiệu hóa các token cũ
    await passwordResetRepository.invalidatePreviousTokens(user.id);

    // Tạo token mới
    const resetToken = await passwordResetRepository.create(user.id);

    // Trong môi trường dev, trả về token trực tiếp
    // TODO: Tích hợp email service để gửi link đặt lại mật khẩu
    return {
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.',
      resetToken: resetToken.token,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await passwordResetRepository.findByToken(token);
    if (!record) throw new BadRequestError('Mã xác thực không hợp lệ.');
    if (record.isUsed) throw new BadRequestError('Mã xác thực đã được sử dụng.');
    if (new Date() > record.expiresAt) throw new BadRequestError('Mã xác thực đã hết hạn.');

    const passwordHash = await SecurityHelper.hashPassword(newPassword);
    // Reset qua email token: user đã chủ động chọn mật khẩu mới → không cần buộc đổi lại.
    await userRepository.updatePassword(record.userId, passwordHash, false);
    await passwordResetRepository.markAsUsed(record.id);

    return { message: 'Đặt lại mật khẩu thành công.' };
  }
}
export const authService = new AuthService();
