import crypto from 'crypto';
import { userRepository } from '../repositories/user.repository';
import { SecurityHelper } from '../utils/securityHelper';
import { NotFoundError, BadRequestError } from '../utils/apiResponse';
import { UserRole } from '@prisma/client';
import { uploadService } from './upload.service';
import { prisma } from '../config/prisma';

export class UserService {
  /**
   * Lấy thông tin hồ sơ chi tiết của người dùng đang đăng nhập
   */
  async getUserProfile(userId: string) {
    const user = await userRepository.findByIdFull(userId);
    if (!user) {
      throw new NotFoundError("Người dùng không tồn tại.");
    }

    // Loại bỏ password trước khi trả về
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    
    // Map enrollments and groupMemberships to what the frontend expects
    if (safeUser.student) {
      const student = safeUser.student as any;
      if (student.enrollments && student.enrollments.length > 0) {
        student.class = student.enrollments[0].class;
        student.classId = student.enrollments[0].classId;
      }
      if (student.groupMemberships && student.groupMemberships.length > 0) {
        student.groupId = student.groupMemberships[0].groupId;
      }
    }
    
    return safeUser;
  }

  /**
   * Cập nhật thông tin liên hệ của chính mình (UC-02)
   */
  async updateUserProfile(userId: string, fullName: string, phoneNumber?: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Người dùng không tồn tại.");
    }

    await userRepository.updateContactInfo(userId, fullName, phoneNumber || undefined);
    
    const fullUser = await userRepository.findByIdFull(userId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = fullUser!;
    return safeUser;
  }

  /**
   * Cập nhật ảnh đại diện (avatar) cho người dùng
   */
  async updateUserAvatar(userId: string, fileBuffer: Buffer, fileName: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("Người dùng không tồn tại.");
    }

    // Upload lên Cloudinary
    const uploadResult = await uploadService.uploadFromBuffer(fileBuffer, {
      folder: 'avatars',
      resourceType: 'image',
    });

    // Cập nhật avatar URL trong database
    await userRepository.updateAvatar(userId, uploadResult.secure_url);

    const fullUser = await userRepository.findByIdFull(userId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = fullUser!;
    return safeUser;
  }

  /**
   * ADMIN: Xem danh sách toàn bộ tài khoản người dùng (UC-13)
   */
  async getAllUsers() {
    const users = await userRepository.findAll();
    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = user;
      return safeUser;
    });
  }

  /**
   * ADMIN: Tạo tài khoản người dùng mới thủ công (UC-13)
   */
  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phoneNumber?: string;
    role: UserRole;
    employeeCodeOrMssv: string;
    classId?: string;
    title?: string;
  }) {
    // 1. Kiểm tra email đã được đăng ký chưa
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestError("Địa chỉ email đã được sử dụng trên hệ thống.");
    }

    // 2. Resolve classId if role is STUDENT
    let finalClassId = data.classId;
    if (data.role === UserRole.STUDENT && data.classId) {
      const clazz = await prisma.class.findFirst({
        where: {
          OR: [
            { id: data.classId },
            { classCode: data.classId }
          ]
        }
      });
      if (!clazz) {
        throw new BadRequestError(`Lớp học phần '${data.classId}' không tồn tại trên hệ thống. Vui lòng nhập lớp học phần trước!`);
      }
      finalClassId = clazz.id;
    }

    // 3. Mã hóa mật khẩu
    const hashedPassword = await SecurityHelper.hashPassword(data.passwordHash);

    // 4. Gọi repository thực thi tạo tài khoản
    const newUser = await userRepository.createUser({
      email: data.email,
      passwordHash: hashedPassword,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      role: data.role,
      employeeCodeOrMssv: data.employeeCodeOrMssv,
      classIds: finalClassId ? [finalClassId] : [],
      title: data.title,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = newUser;
    return safeUser;
  }

  /**
   * ADMIN: Cập nhật vai trò hoặc trạng thái hoạt động tài khoản (UC-13)
   */
  async updateRoleStatus(id: string, role: UserRole, isActive: boolean) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Người dùng không tồn tại.");
    }

    const updatedUser = await userRepository.updateRoleStatus(id, role, isActive);
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  /**
   * ADMIN: Cấp lại mật khẩu mới cho tài khoản người dùng.
   * S5: nếu admin không truyền mật khẩu, sinh mật khẩu ngẫu nhiên (không dùng default cố định Password123@).
   * Trả mật khẩu plaintext mới về cho admin để chuyển cho người dùng.
   */
  async resetPassword(id: string, newPassword?: string) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Người dùng không tồn tại.");
    }

    const plaintext = newPassword && newPassword.length >= 8
      ? newPassword
      : crypto.randomBytes(9).toString('base64url'); // ~12 ký tự an toàn

    const hashedPassword = await SecurityHelper.hashPassword(plaintext);
    const updatedUser = await userRepository.updatePassword(id, hashedPassword);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = updatedUser;
    return { ...safeUser, newPassword: plaintext };
  }
}
export const userService = new UserService();
