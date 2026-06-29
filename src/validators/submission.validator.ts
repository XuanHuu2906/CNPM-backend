import { z } from 'zod';
import { SubmissionStatus } from '@prisma/client';

export const submitReportSchema = z.object({
  body: z.object({
    filePath: z.string({ required_error: "Đường dẫn tệp báo cáo chính là bắt buộc" }).min(2, "Đường dẫn tệp quá ngắn"),
    attachments: z.array(z.string()).optional().default([]),
    classId: z.string({ required_error: "ID lớp học phần là bắt buộc" }),
    // Liên kết ngoài cho source code & video demo. Optional, validate URL nếu có.
    repoLink: z.string().url('Link source code phải là URL hợp lệ').optional().or(z.literal('')),
    videoLink: z.string().url('Link video demo phải là URL hợp lệ').optional().or(z.literal('')),
  }),
});

export const updateSubmissionStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(SubmissionStatus, { required_error: "Trạng thái mới là bắt buộc" }),
    note: z.string().optional(),
    rejectReason: z.string().optional(),
    // B13: phân loại vi phạm khi từ chối / đưa vào diện kiểm tra (vd 'CHO_KIEM_TRA', 'GIAN_LAN'…).
    violationType: z.string().optional(),
    editRequestNote: z.string().optional(),
    version: z.number({ required_error: "Số phiên bản kiểm soát đồng thời (version) là bắt buộc để tránh tranh chấp" }).int().positive(),
  }),
});
