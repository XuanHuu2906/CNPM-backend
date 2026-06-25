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

// UC-09 / UC-I05: GV điều chỉnh hệ số đóng góp thành viên nhóm.
export const memberAdjustmentsSchema = z.object({
  body: z.object({
    adjustments: z.array(
      z.object({
        studentId: z.string({ required_error: 'ID sinh viên là bắt buộc' }).min(1),
        contributionFactor: z
          .number({ required_error: 'Hệ số đóng góp là bắt buộc' })
          .min(0, 'Hệ số tối thiểu là 0')
          .max(1.5, 'Hệ số tối đa là 1.5'),
        note: z.string().max(500).optional(),
      }),
    ).min(1, 'Danh sách điều chỉnh không được rỗng'),
  }),
});
