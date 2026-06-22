import { z } from 'zod';

export const createTermSchema = z.object({
  body: z.object({
    name: z.string({ required_error: "Tên học kỳ là bắt buộc" }).min(2, "Tên học kỳ phải chứa ít nhất 2 ký tự"),
    startDate: z.coerce.date({ required_error: "Ngày bắt đầu học kỳ là bắt buộc" }),
    endDate: z.coerce.date({ required_error: "Ngày kết thúc học kỳ là bắt buộc" }),
  }).refine((data) => data.startDate < data.endDate, {
    message: "Ngày bắt đầu học kỳ phải nhỏ hơn ngày kết thúc",
    path: ["endDate"],
  }),
});

export const updateTermSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Tên học kỳ phải chứa ít nhất 2 ký tự").optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    // UC-19: khóa học kỳ phải đi qua POST /system/semesters/:id/lock để chạy precondition (toàn bộ báo cáo phải HOAN_THANH).
    // Không cho set isLocked trực tiếp qua updateTerm để tránh bypass.
  }).refine((data) => {
    if (data.startDate && data.endDate) {
      return data.startDate < data.endDate;
    }
    return true;
  }, {
    message: "Ngày bắt đầu học kỳ phải nhỏ hơn ngày kết thúc",
    path: ["endDate"],
  }),
});

export const createSubjectSchema = z.object({
  body: z.object({
    subjectCode: z.string({ required_error: "Mã môn học là bắt buộc" }).min(2, "Mã môn học phải chứa ít nhất 2 ký tự").toUpperCase(),
    name: z.string({ required_error: "Tên môn học là bắt buộc" }).min(2, "Tên môn học phải chứa ít nhất 2 ký tự"),
  }),
});

export const createClassSchema = z.object({
  body: z.object({
    classCode: z.string({ required_error: "Mã lớp học phần là bắt buộc" }).min(2, "Mã lớp phải chứa ít nhất 2 ký tự").toUpperCase(),
    subjectId: z.string({ required_error: "ID môn học là bắt buộc" }),
    termId: z.string({ required_error: "ID học kỳ là bắt buộc" }),
  }),
});

export const assignTeacherSchema = z.object({
  body: z.object({
    classId: z.string({ required_error: "ID lớp học phần là bắt buộc" }),
    teacherId: z.string({ required_error: "ID giảng viên là bắt buộc" }),
  }),
});
