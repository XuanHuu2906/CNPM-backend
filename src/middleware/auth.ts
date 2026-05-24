import { Request, Response, NextFunction } from 'express';
import { SecurityHelper } from '../utils/securityHelper';
import { userRepository } from '../repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from '../utils/apiResponse';
import { UserRole } from '@prisma/client';

/**
 * Middleware Xác Thực Token JWT
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Lấy token từ header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError("Vui lòng đăng nhập để thực hiện chức năng này.");
    }

    const token = authHeader.split(' ')[1];

    // 2. Giải mã và kiểm tra token
    let decoded;
    try {
      decoded = SecurityHelper.verifyToken(token);
    } catch {
      throw new UnauthorizedError("Token không hợp lệ hoặc đã hết hạn.");
    }

    // 3. Truy xuất cơ sở dữ liệu kiểm chứng tài khoản thực sự tồn tại và đang hoạt động
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      throw new UnauthorizedError("Tài khoản người dùng đã bị xóa khỏi hệ thống.");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.");
    }

    // 4. Xác định mã diễn viên cụ thể đại diện cho vai trò
    let actorId = '';
    if (user.student) actorId = user.student.id;
    else if (user.teacher) actorId = user.teacher.id;
    else if (user.academicDept) actorId = user.academicDept.id;
    else if (user.admin) actorId = user.admin.id;

    // 5. Gán dữ liệu bảo mật vào Request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
      actorId,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Middleware Phân Quyền Theo Vai Trò (Role-Based Access Control)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Yêu cầu xác thực tài khoản."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Bạn không có quyền thực hiện hành động này."));
    }

    return next();
  };
};
