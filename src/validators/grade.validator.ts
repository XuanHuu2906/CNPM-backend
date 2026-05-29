import { z } from 'zod';

export const submitGradeSchema = z.object({
  body: z.object({
    rubricId: z.string({ required_error: "ID Rubric là bắt buộc" }),
    detailedScores: z.array(
      z.object({
        criteriaId: z.string({ required_error: "ID Tiêu chí con là bắt buộc" }),
        score: z.number({ required_error: "Điểm số là bắt buộc" }).nonnegative("Điểm số không được âm"),
        note: z.string().optional(),
      })
    ).min(1, "Bản điểm phải chứa ít nhất một tiêu chí được chấm"),
    feedback: z.string().optional(),
    version: z.number().int().positive().optional().default(1),
    isDraft: z.boolean().optional().default(false),
  }),
});
