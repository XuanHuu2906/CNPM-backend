import { z } from 'zod';

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string({ required_error: "Tên nhóm là bắt buộc" }).min(2, "Tên nhóm phải chứa ít nhất 2 ký tự"),
    topicName: z.string({ required_error: "Tên đề tài là bắt buộc" }).min(3, "Tên đề tài phải chứa ít nhất 3 ký tự"),
    classId: z.string({ required_error: "ID lớp học phần là bắt buộc" }),
    studentIds: z.array(z.string()).min(1, "Nhóm phải chứa ít nhất 1 sinh viên"),
  }),
});

export const updateTopicSchema = z.object({
  body: z.object({
    topicName: z.string({ required_error: "Tên đề tài mới là bắt buộc" }).min(3, "Tên đề tài mới phải chứa ít nhất 3 ký tự"),
  }),
});

export const updateMembersSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string()).min(1, "Nhóm phải chứa ít nhất 1 sinh viên"),
  }),
});
