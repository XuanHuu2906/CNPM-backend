import { z } from 'zod';

export const approveGradeSchema = z.object({
  body: z.object({
    isApproved: z.boolean({ required_error: "Trạng thái phê duyệt là bắt buộc" }),
    version: z.number({ required_error: "Số phiên bản kiểm soát đồng thời (version) là bắt buộc để tránh tranh chấp" }).int().positive(),
    // UC-16: khi trả về (isApproved=false) thì PĐT phải nhập lý do để lưu vào Submission.rejectReason & SubmissionLog.
    reason: z.string().min(1).optional(),
  }).refine((d) => d.isApproved || (d.reason && d.reason.trim().length >= 5), {
    message: 'Lý do trả về phải có ít nhất 5 ký tự',
    path: ['reason'],
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

// UC-16: phê duyệt / trả về theo lô.
export const batchApproveGradesSchema = z.object({
  body: z.object({
    submissionIds: z
      .array(z.string().min(1))
      .min(1, 'Danh sách bài cần phê duyệt rỗng')
      .max(100, 'Mỗi lần xử lý tối đa 100 bài'),
    action: z.enum(['APPROVE', 'RETURN'], { required_error: 'Hành động phải là APPROVE hoặc RETURN' }),
    reason: z.string().min(1).optional(),
  }).refine((d) => d.action === 'APPROVE' || (d.reason && d.reason.trim().length >= 5), {
    message: 'Lý do trả về phải có ít nhất 5 ký tự',
    path: ['reason'],
  }),
});
