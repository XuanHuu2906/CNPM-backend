import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string({ required_error: "Email là bắt buộc" }).email("Email không hợp lệ"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string({ required_error: "Mã xác thực là bắt buộc" }).min(1),
    newPassword: z
      .string({ required_error: "Mật khẩu mới là bắt buộc" })
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(/[A-Z]/, "Mật khẩu phải chứa ít nhất một ký tự viết hoa")
      .regex(/[a-z]/, "Mật khẩu phải chứa ít nhất một ký tự viết thường")
      .regex(/[0-9]/, "Mật khẩu phải chứa ít nhất một chữ số")
      .regex(/[^A-Za-z0-9]/, "Mật khẩu phải chứa ít nhất một ký tự đặc biệt"),
  }),
});
