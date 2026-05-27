import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string({ required_error: "Email là bắt buộc" }).email({ message: "Email không đúng định dạng" }),
    password: z.string({ required_error: "Mật khẩu là bắt buộc" }).min(6, { message: "Mật khẩu phải từ 6 ký tự trở lên" }),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string({ required_error: "Mật khẩu cũ là bắt buộc" }).min(1, { message: "Mật khẩu cũ không được để trống" }),
    newPassword: z.string({ required_error: "Mật khẩu mới là bắt buộc" }).min(6, { message: "Mật khẩu mới phải từ 6 ký tự trở lên" }),
  }),
});
