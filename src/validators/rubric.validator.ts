import { z } from 'zod';

export const createRubricSchema = z.object({
  body: z.object({
    title: z.string({ required_error: "Tiêu đề Rubric là bắt buộc" }).min(3, "Tiêu đề Rubric phải chứa ít nhất 3 ký tự"),
    description: z.string().optional(),
    criteria: z.array(
      z.object({
        name: z.string({ required_error: "Tên tiêu chí con là bắt buộc" }).min(2, "Tên tiêu chí con phải chứa ít nhất 2 ký tự"),
        description: z.string().optional(),
        maxScore: z.number({ required_error: "Điểm tối đa là bắt buộc" }).positive("Điểm tối đa phải lớn hơn 0"),
        weight: z.number({ required_error: "Trọng số phần trăm là bắt buộc" }).positive("Trọng số phải lớn hơn 0").max(100, "Trọng số không thể lớn hơn 100%"),
      })
    ).min(1, "Bảng Rubric phải chứa ít nhất một tiêu chí con"),
  }),
});

export const updateRubricSchema = z.object({
  body: z.object({
    title: z.string().min(3, "Tiêu đề Rubric phải chứa ít nhất 3 ký tự").optional(),
    description: z.string().optional(),
  }),
});
