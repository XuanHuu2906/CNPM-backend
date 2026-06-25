import ExcelJS from 'exceljs';
import crypto from 'crypto';
import { academicRepository } from '../repositories/academic.repository';
import { userRepository } from '../repositories/user.repository';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { AcademicTerm, Subject, Assignment } from '@prisma/client';
import { SecurityHelper } from '../utils/securityHelper';
import { emailService } from './email.service';
import { logger } from '../utils/logger';

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

  async updateTerm(id: string, data: Partial<{ name: string; startDate: Date; endDate: Date }>): Promise<AcademicTerm> {
    await this.getTermById(id); // Kiểm tra tồn tại

    if (data.name) {
      const existing = await academicRepository.findTermByName(data.name);
      if (existing && existing.id !== id) {
        throw new BadRequestError(`Học kỳ mang tên '${data.name}' đã tồn tại trên hệ thống`);
      }
    }

    // UC-19: không cho phép thay đổi isLocked qua endpoint này — phải dùng POST /system/semesters/:id/lock
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
  // UC-17: ĐỔI GV PHỤ TRÁCH GIỮA KỲ (CHANGE CLASS TEACHER)
  // ==========================================
  // Quy tắc R12:
  //  (a) Điểm nháp + DA_CHAM của GV cũ giữ nguyên (Grade.teacherId không đổi để audit ai chấm).
  //  (b) GV mới được sửa nháp qua verifyTeacherClassOwnership (check Assignment hiện tại).
  //  (c) Điểm CHO_DUYET/HOAN_THANH bị khóa theo R4 — GV mới muốn sửa phải xin mở lại (UC-27).
  //  (d) AssignmentHistory ghi đầy đủ (oldTeacherId, newTeacherId, reason, changedById, snapshot
  //      số bài đang chấm dở để bàn giao).
  async changeClassTeacher(params: {
    classId: string;
    newTeacherId: string;
    reason: string;
    actorId: string;
  }) {
    const { classId, newTeacherId, reason, actorId } = params;

    if (!reason || !reason.trim()) {
      throw new BadRequestError('Lý do đổi giảng viên phụ trách là bắt buộc');
    }

    // 1. Class + term + assignment hiện có
    const clazz = await academicRepository.findClassById(classId);
    if (!clazz) {
      throw new NotFoundError('Không tìm thấy lớp học phần để đổi giảng viên phụ trách');
    }
    if ((clazz as any).term?.isLocked) {
      throw new BadRequestError('Học kỳ chứa lớp này đã bị khóa — không thể đổi giảng viên phụ trách');
    }

    const assignments = (clazz as any).assignments as Array<{ id: string; teacherId: string; teacher: { id: string; user: { fullName: string } } }> | undefined;
    const currentAssignment = assignments && assignments[0] ? assignments[0] : null;
    if (!currentAssignment) {
      throw new BadRequestError('Lớp này chưa có giảng viên phụ trách — vui lòng dùng "Phân công giảng viên" thay vì đổi.');
    }
    const oldTeacherId = currentAssignment.teacherId;
    if (oldTeacherId === newTeacherId) {
      throw new BadRequestError('Giảng viên mới trùng với giảng viên phụ trách hiện tại');
    }

    // 2. GV mới phải tồn tại
    const newTeacher = await prisma.teacher.findUnique({
      where: { id: newTeacherId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    if (!newTeacher) {
      throw new NotFoundError('Không tìm thấy giảng viên mới được chọn');
    }

    // 3. Snapshot số bài đang chấm dở của GV cũ để gửi cho GV mới biết
    const draftStats = await prisma.submission.groupBy({
      by: ['status'],
      where: {
        OR: [
          { group: { classId } },
          { student: { enrollments: { some: { classId } } } },
        ],
        status: { in: ['DA_NOP', 'DANG_CHAM', 'YEU_CAU_SUA'] },
      },
      _count: { _all: true },
    });
    const inProgressCount = draftStats.reduce((sum, row) => sum + row._count._all, 0);

    // 4. Transaction: xoá Assignment cũ, tạo mới, ghi AssignmentHistory
    const result = await prisma.$transaction(async (tx) => {
      const history = await tx.assignmentHistory.create({
        data: {
          classId,
          assignmentId: currentAssignment.id,
          oldTeacherId,
          newTeacherId,
          reason: reason.trim(),
          changedById: actorId,
        },
      });

      await tx.assignment.delete({ where: { id: currentAssignment.id } });
      const newAssignment = await tx.assignment.create({
        data: { classId, teacherId: newTeacherId },
      });

      return { history, newAssignment };
    });

    // 5. Thông báo GV cũ & GV mới (best-effort, không chặn nghiệp vụ chính)
    try {
      const oldTeacher = currentAssignment.teacher;
      const noteForOld = `Phòng Đào tạo đã chuyển bạn khỏi vai trò GV phụ trách lớp ${clazz.classCode}. Lý do: ${reason.trim()}`;
      const noteForNew = `Bạn được phân công làm GV phụ trách lớp ${clazz.classCode}${inProgressCount > 0 ? ` (đang có ${inProgressCount} bài chưa chấm xong từ GV trước).` : '.'}`;

      const [oldUser, newUser] = await Promise.all([
        prisma.teacher.findUnique({ where: { id: oldTeacherId }, select: { userId: true } }),
        prisma.teacher.findUnique({ where: { id: newTeacherId }, select: { userId: true } }),
      ]);

      const notifs: Array<Promise<any>> = [];
      if (oldUser?.userId) {
        notifs.push(prisma.notification.create({
          data: {
            userId: oldUser.userId,
            title: `Thay đổi phân công lớp ${clazz.classCode}`,
            content: noteForOld,
            type: 'HE_THONG',
          },
        }));
      }
      if (newUser?.userId) {
        notifs.push(prisma.notification.create({
          data: {
            userId: newUser.userId,
            title: `Bàn giao lớp ${clazz.classCode}`,
            content: noteForNew,
            type: 'HE_THONG',
          },
        }));
      }
      await Promise.all(notifs);
    } catch (err: any) {
      logger.warn(`[UC-17] Không gửi được thông báo bàn giao GV lớp ${classId}: ${err.message}`);
    }

    return {
      classId,
      classCode: clazz.classCode,
      oldTeacherId,
      newTeacherId,
      newTeacher: {
        id: newTeacher.id,
        teacherCode: newTeacher.teacherCode,
        fullName: newTeacher.user.fullName,
        email: newTeacher.user.email,
      },
      inProgressCount,
      historyId: result.history.id,
      assignmentId: result.newAssignment.id,
    };
  }

  async getClassAssignmentHistory(classId: string) {
    return await prisma.assignmentHistory.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      include: {
        oldTeacher: { include: { user: { select: { fullName: true, email: true } } } },
        newTeacher: { include: { user: { select: { fullName: true, email: true } } } },
        changedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
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

  // ==========================================
  // IMPORT 1 LỚP TỪ FILE EXCEL (UC-13 — PĐT)
  // ==========================================

  /**
   * Mỗi file Excel = 1 lớp học phần hoàn chỉnh.
   * Cấu trúc bắt buộc (theo template `DanhSachSinhVien_CNPM.xlsx`):
   * - Sheet "Điểm Danh"
   * - Row 2, col D : Tên học kỳ (vd "HỌC KỲ 2 - NĂM HỌC 2025 - 2026")
   * - Row 4, col C : Tên môn (vd "Nhập môn công nghệ phần mềm")
   * - Row 4, col E : Mã môn  (vd "CNPM01")
   * - Row 6, col B : Mã lớp  (vd "D23CQCN01-N")
   * - Row 6, col D : Mã GV phụ trách (vd "GV001")
   * - Row 7         : header bảng SV
   * - Row 8+        : MSSV (col B), Họ lót (col C), Tên (col D)
   * Hành vi:
   * - Subject: find theo subjectCode → tạo mới nếu chưa có
   * - Term: find theo termName → tạo mới (default 5 tháng) nếu chưa có
   * - Class: throw nếu classCode đã tồn tại (1 file = 1 lớp mới)
   * - Teacher: find theo teacherCode → throw nếu không có
   * - SV: tự tạo User (mật khẩu mặc định "123456", mustChangePassword=true) + Student nếu MSSV chưa có
   */
  async importClassFromExcel(fileBuffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const sheet =
      workbook.getWorksheet('Điểm Danh') ||
      workbook.getWorksheet('Diem Danh') ||
      workbook.worksheets[0];
    if (!sheet) throw new BadRequestError('File Excel không có sheet nào');

    const readStr = (row: number, col: number) => {
      const v = sheet.getRow(row).getCell(col).value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && (v as any).text) return String((v as any).text).trim();
      return String(v).trim();
    };

    const termName = readStr(2, 4);
    const subjectName = readStr(4, 3);
    const subjectCode = readStr(4, 5);
    const classCode = readStr(6, 2);
    const teacherCode = readStr(6, 4);

    if (!termName) throw new BadRequestError('Thiếu Tên học kỳ ở ô D2 (row 2, cột D)');
    if (!subjectName) throw new BadRequestError('Thiếu Tên môn ở ô C4');
    if (!subjectCode) throw new BadRequestError('Thiếu Mã môn ở ô E4');
    if (!classCode) throw new BadRequestError('Thiếu Mã lớp ở ô B6');
    if (!teacherCode) throw new BadRequestError('Thiếu Mã giảng viên phụ trách ở ô D6');

    // 1) Validate trước khi vào transaction
    const existingClass = await academicRepository.findClassByCode(classCode);
    if (existingClass) {
      throw new BadRequestError(`Lớp '${classCode}' đã tồn tại trên hệ thống — mỗi file chỉ tạo 1 lớp mới`);
    }

    const teacher = await prisma.teacher.findUnique({
      where: { teacherCode },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!teacher) {
      throw new BadRequestError(`Không tìm thấy giảng viên có mã '${teacherCode}'`);
    }

    // 2) Parse danh sách SV (row 8+)
    type Row = { mssv: string; fullName: string };
    const rows: Row[] = [];
    const seenMssv = new Set<string>();
    const lastRow = sheet.actualRowCount || sheet.rowCount;
    for (let r = 8; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      const mssv = readStr(r, 2);
      if (!mssv) continue;
      const upper = mssv.toUpperCase();
      if (seenMssv.has(upper)) {
        throw new BadRequestError(`Dòng ${r}: MSSV ${mssv} bị trùng trong file`);
      }
      seenMssv.add(upper);
      const hoLot = readStr(r, 3);
      const ten = readStr(r, 4);
      const fullName = `${hoLot} ${ten}`.replace(/\s+/g, ' ').trim() || mssv;
      rows.push({ mssv: upper, fullName });
    }
    if (rows.length === 0) {
      throw new BadRequestError('Không có sinh viên nào trong file');
    }

    // 3) Pre-load SV đã có trong DB
    const existingStudents = await prisma.student.findMany({
      where: { studentCode: { in: [...seenMssv] } },
      select: { id: true, studentCode: true },
    });
    const studentByCode = new Map(existingStudents.map(s => [s.studentCode.toUpperCase(), { id: s.id }]));

    const defaultPasswordHash = await SecurityHelper.hashPassword('123456');

    // 4) Find or create Subject / Term ngoài transaction (để tránh giữ lock dài)
    let subject = await academicRepository.findSubjectByCode(subjectCode);
    if (!subject) {
      subject = await academicRepository.createSubject({ subjectCode, name: subjectName });
    } else if (subject.name !== subjectName) {
      // không tự sửa, chỉ ghi nhận warning
    }

    let term = await academicRepository.findTermByName(termName);
    if (!term) {
      term = await academicRepository.createTerm({
        name: termName,
        startDate: new Date(),
        endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
      });
    } else if (term.isLocked) {
      throw new BadRequestError(`Học kỳ '${termName}' đã bị khóa — không thể tạo lớp mới`);
    }

    // 5) Transaction: tạo Class + Assignment + auto-create SV + Enrollment
    return await prisma.$transaction(async (tx) => {
      const clazz = await tx.class.create({
        data: { classCode, subjectId: subject!.id, termId: term!.id },
      });

      await tx.assignment.create({
        data: { classId: clazz.id, teacherId: teacher.id },
      });

      let createdUsersCount = 0;
      for (const r of rows) {
        if (studentByCode.has(r.mssv)) continue;
        const email = `${r.mssv.toLowerCase()}@stu.local`;
        const user = await tx.user.create({
          data: {
            email,
            password: defaultPasswordHash,
            fullName: r.fullName,
            role: 'STUDENT',
            isActive: true,
            mustChangePassword: true,
            student: { create: { studentCode: r.mssv } },
          },
          include: { student: { select: { id: true } } },
        });
        createdUsersCount++;
        studentByCode.set(r.mssv, { id: user.student!.id });
      }

      const studentIds = rows.map(r => studentByCode.get(r.mssv)!.id);
      await tx.classEnrollment.createMany({
        data: studentIds.map(studentId => ({ studentId, classId: clazz.id })),
      });

      return {
        class: {
          id: clazz.id,
          classCode: clazz.classCode,
          subject: { code: subject!.subjectCode, name: subject!.name },
          term: { id: term!.id, name: term!.name },
        },
        teacher: {
          id: teacher.id,
          teacherCode: teacher.teacherCode,
          fullName: teacher.user.fullName,
          email: teacher.user.email,
        },
        studentCount: rows.length,
        createdUsersCount,
        enrolledCount: studentIds.length,
      };
    });
  }

  // ==========================================
  // BULK IMPORT SINH VIÊN + GỬI MAIL TÀI KHOẢN (UC-13 — PĐT)
  // ==========================================

  /**
   * Excel format:
   * - Sheet đầu tiên (hoặc tên "Sinh Vien" / "DanhSachSV")
   * - Row 1: header (MSSV | Họ tên | Email)
   * - Row 2+: dữ liệu
   * Hành vi:
   * - MSSV đã tồn tại  → skip (không reset password, không gửi mail)
   * - MSSV mới        → tạo User + Student với password ngẫu nhiên (mustChangePassword=true)
   *                     → gửi email kèm MSSV + password
   */
  async bulkImportStudents(fileBuffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const sheet =
      workbook.getWorksheet('Sinh Vien') ||
      workbook.getWorksheet('DanhSachSV') ||
      workbook.worksheets[0];
    if (!sheet) throw new BadRequestError('File Excel không có sheet nào');

    const readStr = (row: number, col: number) => {
      const v = sheet.getRow(row).getCell(col).value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        const obj = v as any;
        if (obj.text) return String(obj.text).trim();
        if (obj.richText) return obj.richText.map((t: any) => t.text).join('').trim();
        if (obj.hyperlink) return String(obj.text || obj.hyperlink).trim();
      }
      return String(v).trim();
    };

    type Row = { mssv: string; fullName: string; email: string; rowIndex: number };
    const rows: Row[] = [];
    const seenMssv = new Set<string>();
    const lastRow = sheet.actualRowCount || sheet.rowCount;

    for (let r = 2; r <= lastRow; r++) {
      const mssv = readStr(r, 1);
      if (!mssv) continue;
      const upper = mssv.toUpperCase();
      if (seenMssv.has(upper)) {
        throw new BadRequestError(`Dòng ${r}: MSSV ${mssv} bị trùng trong file`);
      }
      seenMssv.add(upper);

      const fullName = readStr(r, 2);
      const email = readStr(r, 3).toLowerCase();

      if (!fullName) throw new BadRequestError(`Dòng ${r}: thiếu Họ tên (cột B)`);
      if (!email) throw new BadRequestError(`Dòng ${r}: thiếu Email (cột C)`);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestError(`Dòng ${r}: Email '${email}' không hợp lệ`);
      }

      rows.push({ mssv: upper, fullName, email, rowIndex: r });
    }

    if (rows.length === 0) {
      throw new BadRequestError('Không có sinh viên nào trong file');
    }
    if (rows.length > 1000) {
      throw new BadRequestError('Mỗi lần nhập tối đa 1000 sinh viên');
    }

    // Pre-load các MSSV đã tồn tại để phân loại skip
    const existing = await prisma.student.findMany({
      where: { studentCode: { in: [...seenMssv] } },
      select: { studentCode: true },
    });
    const existingSet = new Set(existing.map(s => s.studentCode.toUpperCase()));

    // Pre-load email đã tồn tại (tránh đụng unique constraint)
    const emailList = rows.map(r => r.email);
    const existingEmails = await prisma.user.findMany({
      where: { email: { in: emailList } },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingEmails.map(u => u.email.toLowerCase()));

    type Result =
      | { mssv: string; fullName: string; email: string; status: 'CREATED' }
      | { mssv: string; fullName: string; email: string; status: 'SKIPPED'; reason: string }
      | { mssv: string; fullName: string; email: string; status: 'FAILED'; reason: string };

    const results: Result[] = [];
    // Lưu plaintext password tạm (sau khi tạo xong tx) để gửi email — KHÔNG log/persist
    const toEmail: Array<{ mssv: string; fullName: string; email: string; password: string }> = [];

    for (const r of rows) {
      if (existingSet.has(r.mssv)) {
        results.push({ mssv: r.mssv, fullName: r.fullName, email: r.email, status: 'SKIPPED', reason: 'MSSV đã tồn tại' });
        continue;
      }
      if (existingEmailSet.has(r.email)) {
        results.push({ mssv: r.mssv, fullName: r.fullName, email: r.email, status: 'SKIPPED', reason: 'Email đã được dùng' });
        continue;
      }

      const password = generateRandomPassword(10);
      const hash = await SecurityHelper.hashPassword(password);

      try {
        await prisma.user.create({
          data: {
            email: r.email,
            password: hash,
            fullName: r.fullName,
            role: 'STUDENT',
            isActive: true,
            mustChangePassword: true,
            student: { create: { studentCode: r.mssv } },
          },
        });
        results.push({ mssv: r.mssv, fullName: r.fullName, email: r.email, status: 'CREATED' });
        toEmail.push({ mssv: r.mssv, fullName: r.fullName, email: r.email, password });
        existingEmailSet.add(r.email);
      } catch (err: any) {
        results.push({ mssv: r.mssv, fullName: r.fullName, email: r.email, status: 'FAILED', reason: err.message || 'Lỗi tạo tài khoản' });
      }
    }

    // Gửi mail bất đồng bộ (best-effort, không chặn response)
    let emailSentCount = 0;
    for (const item of toEmail) {
      const html = renderCredentialEmail({ fullName: item.fullName, mssv: item.mssv, password: item.password });
      const sent = await emailService.sendEmail(
        item.email,
        'Tài khoản hệ thống Chấm điểm Báo cáo của bạn',
        html,
        'STUDENT_ACCOUNT_CREATED',
        `student-account-${item.mssv}`,
      );
      if (sent) emailSentCount++;
      else logger.warn(`Không gửi được mail tài khoản cho ${item.email} (MSSV ${item.mssv})`);
    }

    return {
      totalRows: rows.length,
      createdCount: results.filter(r => r.status === 'CREATED').length,
      skippedCount: results.filter(r => r.status === 'SKIPPED').length,
      failedCount: results.filter(r => r.status === 'FAILED').length,
      emailSentCount,
      results,
    };
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

/**
 * Sinh mật khẩu ngẫu nhiên crypto-strong, loại bỏ ký tự dễ nhầm (0/O/1/l/I).
 */
function generateRandomPassword(length: number = 10): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

function renderCredentialEmail(payload: { fullName: string; mssv: string; password: string }): string {
  const { fullName, mssv, password } = payload;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #4F46E5; margin-bottom: 8px;">Chào ${fullName},</h2>
      <p>Phòng Đào Tạo đã khởi tạo tài khoản cho bạn trên Hệ thống Chấm điểm Báo cáo.</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 8px;"><b>Tài khoản (MSSV):</b> <code style="background:#fff;padding:2px 8px;border-radius:4px;">${mssv}</code></p>
        <p style="margin:0;"><b>Mật khẩu tạm thời:</b> <code style="background:#fff;padding:2px 8px;border-radius:4px;">${password}</code></p>
      </div>
      <p style="color:#b91c1c;font-weight:bold;">Lưu ý: Bạn bắt buộc phải đổi mật khẩu trong lần đăng nhập đầu tiên.</p>
      <p>Trân trọng,<br/>Phòng Đào Tạo</p>
    </div>
  `;
}

export const academicService = new AcademicService();
