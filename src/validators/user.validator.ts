import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string({ required_error: "Họ tên không được để trống" }).min(2, { message: "Họ tên phải từ 2 ký tự trở lên" }),
    phoneNumber: z.string().nullable().optional(),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string({ required_error: "Email là bắt buộc" }).email({ message: "Email không hợp lệ" }),
    password: z.string({ required_error: "Mật khẩu là bắt buộc" }).min(6, { message: "Mật khẩu phải từ 6 ký tự trở lên" }),
    fullName: z.string({ required_error: "Họ tên là bắt buộc" }).min(2, { message: "Họ tên phải từ 2 ký tự trở lên" }),
    phoneNumber: z.string().optional(),
    role: z.nativeEnum(UserRole, { errorMap: () => ({ message: "Vai trò không hợp lệ" }) }),
    employeeCodeOrMssv: z.string({ required_error: "Mã số định danh là bắt buộc" }).min(1, { message: "Mã số định danh không được để trống" }),
    classIds: z.array(z.string()).optional(), // Danh sách lớp học phần cho sinh viên
    title: z.string().optional(),    // Thạc sĩ, Tiến sĩ cho TEACHER
  }),
});

export const updateRoleStatusSchema = z.object({
  body: z.object({
    role: z.nativeEnum(UserRole, { errorMap: () => ({ message: "Vai trò không hợp lệ" }) }),
    isActive: z.boolean({ required_error: "Trạng thái hoạt động là bắt buộc" }),
  }),
});
