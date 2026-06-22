import { academicRepository } from '../repositories/academic.repository';
import { userRepository } from '../repositories/user.repository';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { AcademicTerm, Subject, Class, Assignment } from '@prisma/client';

export class AcademicService {
  // ==========================================
  // ACADEMIC TERM (HỌC KỲ)
  // ==========================================

  async createTerm(data: { name: string; startDate: Date; endDate: Date }): Promise<AcademicTerm> {
    const existing = await academicRepository.findTermByName(data.name);
    if (existing) {
      throw new BadRequestError(`Học kỳ mang tên '${data.name}' đã tồn tại trên hệ thống`);
    }
    return await academicRepository.createTerm(data);
  }

  async getAllTerms(): Promise<AcademicTerm[]> {
    return await academicRepository.getAllTerms();
  }

  async getTermById(id: string): Promise<AcademicTerm> {
    const term = await academicRepository.findTermById(id);
    if (!term) {
      throw new NotFoundError("Không tìm thấy thông tin học kỳ yêu cầu");
    }
    return term;
  }

  async updateTerm(id: string, data: Partial<{ name: string; startDate: Date; endDate: Date; isLocked: boolean }>): Promise<AcademicTerm> {
    await this.getTermById(id); // Kiểm tra tồn tại
    
    if (data.name) {
      const existing = await academicRepository.findTermByName(data.name);
      if (existing && existing.id !== id) {
        throw new BadRequestError(`Học kỳ mang tên '${data.name}' đã tồn tại trên hệ thống`);
      }
    }

    return await academicRepository.updateTerm(id, data);
  }

  // ==========================================
  // SUBJECT (MÔN HỌC)
  // ==========================================

  async createSubject(data: { subjectCode: string; name: string }): Promise<Subject> {
    const existing = await academicRepository.findSubjectByCode(data.subjectCode);
    if (existing) {
      throw new BadRequestError(`Môn học có mã '${data.subjectCode}' đã tồn tại`);
    }
    return await academicRepository.createSubject(data);
  }

  async getAllSubjects(): Promise<Subject[]> {
    return await academicRepository.getAllSubjects();
  }

  // ==========================================
  // CLASS (LỚP HỌC PHẦN)
  // ==========================================

  async createClass(data: { classCode: string; subjectId: string; termId: string }): Promise<Class> {
    // 1. Kiểm tra trùng mã lớp học phần
    const existing = await academicRepository.findClassByCode(data.classCode);
    if (existing) {
      throw new BadRequestError(`Lớp học phần có mã '${data.classCode}' đã tồn tại`);
    }

    // 2. Kiểm tra tồn tại môn học
    const subject = await academicRepository.findSubjectById(data.subjectId);
    if (!subject) {
      throw new NotFoundError("Không tìm thấy thông tin môn học đã chọn");
    }

    // 3. Kiểm tra tồn tại học kỳ
    const term = await academicRepository.findTermById(data.termId);
    if (!term) {
      throw new NotFoundError("Không tìm thấy thông tin học kỳ đã chọn");
    }

    return await academicRepository.createClass(data);
  }

  async getAllClasses() {
    return await academicRepository.getAllClasses();
  }

  async getClassById(id: string) {
    const clazz = await academicRepository.findClassById(id);
    if (!clazz) {
      throw new NotFoundError("Không tìm thấy thông tin lớp học phần yêu cầu");
    }
    return clazz;
  }

  // ==========================================
  // ASSIGNMENT (PHÂN CÔNG GIẢNG DẠY)
  // ==========================================

  async assignTeacher(data: { classId: string; teacherId: string }): Promise<Assignment> {
    // 1. Kiểm tra tồn tại lớp học
    await this.getClassById(data.classId);

    // 2. Kiểm tra tồn tại giảng viên
    const teacher = await prisma.teacher.findUnique({ where: { id: data.teacherId } });
    if (!teacher) {
      throw new NotFoundError("Không tìm thấy thông tin giảng viên yêu cầu");
    }

    // 3. Kiểm tra đã phân công chưa (nếu đã phân công thì trả về thành công thay vì ném lỗi)
    const existing = await academicRepository.findAssignment(data.classId, data.teacherId);
    if (existing) {
      return existing;
    }

    return await academicRepository.assignTeacher(data);
  }

  async unassignTeacher(classId: string, teacherId: string): Promise<Assignment> {
    const existing = await academicRepository.findAssignment(classId, teacherId);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy bản ghi phân công này để xóa");
    }
    return await academicRepository.unassignTeacher(classId, teacherId);
  }

  async getTeacherAssignments(teacherId: string) {
    return await academicRepository.getTeacherAssignments(teacherId);
  }

  // ==========================================
  // BUSINESS LOCK GUARD (CHỐT CHẶN KHÓA NIÊN KHÓA)
  // ==========================================

  /**
   * Phương thức chốt chặn nghiệp vụ (Business Guard).
   * Kiểm tra nếu học kỳ chứa lớp học phần này đã bị khóa (isLocked = true),
   * ném lỗi chặn đứng hành vi sửa đổi dữ liệu.
   */
  async verifyTermActive(classId: string): Promise<void> {
    const clazz = await academicRepository.findClassById(classId);
    if (!clazz) {
      throw new NotFoundError("Không tìm thấy thông tin lớp học phần");
    }
    if (clazz.term.isLocked) {
      throw new BadRequestError(`Học kỳ '${clazz.term.name}' đã bị khóa điểm toàn cục. Không cho phép thực hiện hành động chỉnh sửa này!`);
    }
  }

  // ==========================================
  // BATCH IMPORTS (NHẬP HÀNG LOẠT)
  // ==========================================

  async createTermsBatch(terms: any[]) {
    const results = [];
    for (const termData of terms) {
      try {
        const name = termData.name;
        const startDate = new Date(termData.startDate);
        const endDate = new Date(termData.endDate);

        if (!name) {
          throw new Error("Mã học kỳ không được để trống!");
        }
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error("Ngày bắt đầu hoặc ngày kết thúc không hợp lệ!");
        }
        if (startDate >= endDate) {
          throw new Error("Ngày bắt đầu học kỳ phải nhỏ hơn ngày kết thúc!");
        }

        const existing = await academicRepository.findTermByName(name);
        if (existing) {
          results.push({ success: true, name, term: existing, note: "Mã học kỳ đã tồn tại" });
          continue;
        }

        const created = await academicRepository.createTerm({ name, startDate, endDate });
        results.push({ success: true, name, term: created });
      } catch (err: any) {
        results.push({ success: false, name: termData.name || "Không rõ", error: err.message });
      }
    }
    return results;
  }

  async createClassesBatch(classes: any[]) {
    const results = [];
    for (const classData of classes) {
      try {
        const { classCode, subjectCode, subjectName, termName, teacherCode } = classData;

        if (!classCode) {
          throw new Error("Mã lớp học phần không được để trống!");
        }
        if (!subjectCode || !subjectName) {
          throw new Error("Mã môn và tên môn không được để trống!");
        }
        if (!termName) {
          throw new Error("Tên học kỳ không được để trống!");
        }
        if (!teacherCode) {
          throw new Error("Mã giảng viên phụ trách không được để trống!");
        }

        // 1. Tìm hoặc tạo môn học
        let subject = await academicRepository.findSubjectByCode(subjectCode);
        if (!subject) {
          subject = await academicRepository.createSubject({
            subjectCode,
            name: subjectName,
          });
        }

        // 2. Tìm hoặc tạo học kỳ
        let term = await academicRepository.findTermByName(termName);
        if (!term) {
          term = await academicRepository.createTerm({
            name: termName,
            startDate: new Date(),
            endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000), // Mặc định 5 tháng sau
          });
        }

        // 3. Tìm hoặc tạo lớp học phần
        let clazz = await academicRepository.findClassByCode(classCode);
        if (!clazz) {
          clazz = await academicRepository.createClass({
            classCode,
            subjectId: subject.id,
            termId: term.id,
          });
        }

        // 4. Phân công giảng viên nếu có mã giảng viên
        let assignedTeacher = null;
        if (teacherCode) {
          const teacher = await prisma.teacher.findUnique({
            where: { teacherCode },
            include: { user: true }
          });
          if (teacher) {
            const assignment = await academicRepository.findAssignment(clazz.id, teacher.id);
            if (!assignment) {
              await academicRepository.assignTeacher({
                classId: clazz.id,
                teacherId: teacher.id,
              });
            }
            assignedTeacher = teacher.user.fullName;
          } else {
            throw new Error(`Không tìm thấy giảng viên có mã '${teacherCode}' trên hệ thống!`);
          }
        }

        results.push({
          success: true,
          classCode,
          class: clazz,
          assignedTeacher,
        });
      } catch (err: any) {
        results.push({
          success: false,
          classCode: classData.classCode || "Không rõ",
          error: err.message,
        });
      }
    }
    return results;
  }

  async createEnrollmentsBatch(enrollments: any[]) {
    // S4: hạn chế kích thước batch để tránh DoS / cạn bộ nhớ
    if (enrollments.length > 500) {
      throw new BadRequestError('Mỗi lần nhập tối đa 500 bản ghi đăng ký lớp');
    }
    const results = [];
    for (const data of enrollments) {
      try {
        const { classCode, mssv } = data;

        if (!classCode) {
          throw new Error("Mã lớp học phần không được để trống!");
        }
        if (!mssv) {
          throw new Error("MSSV không được để trống!");
        }

        // 1. Kiểm tra tồn tại lớp học
        const clazz = await academicRepository.findClassByCode(classCode);
        if (!clazz) {
          throw new Error(`Mã lớp học phần '${classCode}' không tồn tại trên hệ thống!`);
        }

        // 2. Kiểm tra tồn tại sinh viên
        const student = await prisma.student.findUnique({
          where: { studentCode: mssv },
          include: { user: true },
        });
        if (!student) {
          throw new Error(`Sinh viên có MSSV '${mssv}' không tồn tại!`);
        }

        // 3. Kiểm tra đã enroll chưa
        const existing = await academicRepository.findEnrollment(student.id, clazz.id);
        if (existing) {
          results.push({
            success: true,
            classCode,
            mssv,
            studentName: student.user.fullName,
            note: "Sinh viên đã đăng ký lớp này trước đó",
          });
          continue;
        }

        // 4. Tạo enrollment
        await academicRepository.createEnrollment(student.id, clazz.id);

        results.push({
          success: true,
          classCode,
          mssv,
          studentName: student.user.fullName,
        });
      } catch (err: any) {
        results.push({
          success: false,
          classCode: data.classCode || "Không rõ",
          mssv: data.mssv || "Không rõ",
          error: err.message,
        });
      }
    }
    return results;
  }
}

// Cần import prisma vì service này có kiểm tra giảng viên trực tiếp qua prisma model phụ
import { prisma } from '../config/prisma';

export const academicService = new AcademicService();
