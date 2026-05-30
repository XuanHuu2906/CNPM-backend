import { z } from 'zod';

export const approveGradeSchema = z.object({
  body: z.object({
    isApproved: z.boolean({ required_error: "Trạng thái phê duyệt là bắt buộc" }),
    version: z.number({ required_error: "Số phiên bản kiểm soát đồng thời (version) là bắt buộc để tránh tranh chấp" }).int().positive(),
  }),
});

export const updateConfigSchema = z.object({
  body: z.object({
    key: z.string({ required_error: "Khóa cấu hình là bắt buộc" }).min(2, "Khóa cấu hình quá ngắn"),
    value: z.string({ required_error: "Giá trị cấu hình là bắt buộc" }),
    description: z.string().optional(),
  }),
});

export const restoreDbSchema = z.object({
  body: z.object({
    backupFile: z.string({ required_error: "Tên tệp tin sao lưu khôi phục là bắt buộc" }).min(5, "Tên tệp tin quá ngắn"),
  }),
});
