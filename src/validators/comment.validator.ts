import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.object({
    content: z.string({ required_error: "Nội dung bình luận là bắt buộc" }).min(1, "Nội dung bình luận không được để trống"),
  }),
  params: z.object({
    submissionId: z.string({ required_error: "Mã bài nộp là bắt buộc" }),
  }),
});
