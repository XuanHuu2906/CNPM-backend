import { prisma } from '../config/prisma';
import { UserRole } from '@prisma/client';

export class UserRepository {
  /**
   * Tìm người dùng qua Email kèm các thông tin phân vai trò cụ thể
   */
  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        admin: true,
        teacher: true,
        student: true,
        academicDept: true,
      },
    });
  }

  /**
   * Tìm người dùng qua ID kèm thông tin vai trò (chỉ lấy role record, không deep-nested)
   */
  async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        admin: true,
        teacher: true,
        student: true,
        academicDept: true,
      },
    });
  }

  /**
   * Tìm người dùng qua ID kèm dữ liệu đầy đủ (dành cho admin/teacher pages)
   */
  async findByIdFull(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        admin: true,
        teacher: {
          include: {
            assignments: {
              include: {
                class: {
                  include: {
                    subject: true,
                    term: true,
                  }
                }
              }
            }
          }
        },
        student: {
          include: {
            groupMemberships: true,
            enrollments: {
              include: {
                class: {
                  include: {
                    term: true,
                    assignments: {
                      include: {
                        teacher: {
                          include: {
                            user: {
                              select: { fullName: true }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        academicDept: true,
      },
    });
  }

  /**
   * Cập nhật thông tin liên lạc cá nhân
   */
  async updateContactInfo(id: string, fullName: string, phoneNumber?: string) {
    return await prisma.user.update({
      where: { id },
      data: {
        fullName,
        phoneNumber,
      },
    });
  }

  /**
   * Thay đổi mật khẩu người dùng.
   * UC-13: khi admin reset → mustChangePassword=true (buộc đổi lần đăng nhập kế tiếp);
   *        khi user tự đổi qua /auth/change-password → false.
   */
  async updatePassword(id: string, passwordHash: string, mustChangePassword: boolean = false) {
    return await prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
        mustChangePassword,
      },
    });
  }

  /**
   * ADMIN: Xem danh sách toàn bộ tài khoản
   */
  async findAll() {
    return await prisma.user.findMany({
      include: {
        admin: true,
        teacher: true,
        student: {
          include: { enrollments: true }
        },
        academicDept: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ADMIN: Cập nhật vai trò hoặc khóa/mở tài khoản
   */
  async updateRoleStatus(id: string, role: UserRole, isActive: boolean) {
    return await prisma.user.update({
      where: { id },
      data: {
        role,
        isActive,
      },
    });
  }

  /**
   * Cập nhật ảnh đại diện (avatar) người dùng
   */
  async updateAvatar(id: string, avatarUrl: string) {
    return await prisma.user.update({
      where: { id },
      data: {
        avatar: avatarUrl,
      },
    });
  }

  /**
   * ADMIN: Tạo người dùng mới thủ công
   */
  async createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phoneNumber?: string;
    role: UserRole;
    employeeCodeOrMssv: string;
    classIds?: string[]; // Danh sách mã lớp cho sinh viên
    title?: string;    // Tuỳ chọn cho teacher
  }) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: data.passwordHash,
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          role: data.role,
          // UC-13: tài khoản do admin tạo thủ công → buộc đổi mật khẩu lần đăng nhập đầu.
          mustChangePassword: true,
        },
      });

      if (data.role === UserRole.ADMIN) {
        await tx.admin.create({
          data: {
            employeeCode: data.employeeCodeOrMssv,
            userId: user.id,
          },
        });
      } else if (data.role === UserRole.ACADEMIC_DEPT) {
        await tx.academicDept.create({
          data: {
            employeeCode: data.employeeCodeOrMssv,
            userId: user.id,
          },
        });
      } else if (data.role === UserRole.TEACHER) {
        await tx.teacher.create({
          data: {
            teacherCode: data.employeeCodeOrMssv,
            title: data.title || null,
            userId: user.id,
          },
        });
      } else if (data.role === UserRole.STUDENT) {
        const createdStudent = await tx.student.create({
          data: {
            studentCode: data.employeeCodeOrMssv,
            userId: user.id,
          },
        });
        if (data.classIds && data.classIds.length > 0) {
          await tx.classEnrollment.createMany({
            data: data.classIds.map(cid => ({
              studentId: createdStudent.id,
              classId: cid
            }))
          });
        }
      }

      return user;
    });
  }
}
export const userRepository = new UserRepository();
