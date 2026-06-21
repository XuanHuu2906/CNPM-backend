import { z } from 'zod';

export const createEditRequestSchema = z.object({
  body: z.object({
    content: z.string({ required_error: "Nội dung yêu cầu sửa là bắt buộc" }).min(1, "Nội dung yêu cầu sửa không được để trống"),
  }),
  params: z.object({
    submissionId: z.string({ required_error: "Mã bài nộp là bắt buộc" }),
  }),
});
