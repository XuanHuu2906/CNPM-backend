import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';
import { academicService } from './academic.service';
import { academicRepository } from '../repositories/academic.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/apiResponse';
import { SecurityHelper } from '../utils/securityHelper';
import '@prisma/client';
import { AssignmentType } from '../config/prisma';

const isRedFont = (argb?: string) => {
  if (!argb) return false;
  const u = argb.toUpperCase();
  return u === 'FFFF0000' || u === 'FF0000';
};

export class TeacherService {
  /**
   * Kiểm tra giảng viên có được phân công LHP này không
   */
  private async verifyOwnership(classId: string, teacherId: string) {
    const assignment = await prisma.assignment.findFirst({
      where: { classId, teacherId },
    });
    if (!assignment) {
      throw new ForbiddenError("Bạn không được phân công phụ trách lớp học phần này");
    }
    return assignment;
  }

  /**
   * Lấy danh sách LHP được phân công cho giảng viên
   */
  async getAssignedClassSections(teacherId: string) {
    const assignments = await prisma.assignment.findMany({
      where: { teacherId },
      include: {
        class: {
          include: {
            subject: true,
            term: true,
            _count: {
              select: { enrollments: true, groups: true },
            },
          },
        },
      },
    });

    return assignments.map(a => ({
      id: a.class.id,
      classCode: a.class.classCode,
      assignmentType: a.class.assignmentType,
      subject: a.class.subject,
      term: a.class.term,
      studentCount: a.class._count.enrollments,
      groupCount: a.class._count.groups,
    }));
  }

  /**
   * Lấy danh sách SV đã enroll LHP, kèm trạng thái nhóm
   */
  async getStudentsByClassId(classId: string, teacherId: string) {
    await this.verifyOwnership(classId, teacherId);

    const enrollments = await academicRepository.getStudentsByClassId(classId);

    return enrollments.map(e => {
      const groupInClass = e.student.groupMemberships.find(
        gm => gm.group.classId === classId
      );
      return {
        id: e.student.id,
        studentCode: e.student.studentCode,
        fullName: e.student.user.fullName,
        email: e.student.user.email,
        groupId: groupInClass?.group.id || null,
        groupName: groupInClass?.group.name || null,
        enrolledAt: e.createdAt,
      };
    });
  }

  /**
   * Lấy nhóm của LHP, kèm members + topic
   */
  async getGroupsByClassId(classId: string, teacherId: string) {
    await this.verifyOwnership(classId, teacherId);

    return await prisma.group.findMany({
      where: { classId },
      include: {
        members: {
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
        submissions: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Tạo nhóm + GroupMember
   */
  async createGroup(classId: string, teacherId: string, data: { name: string; topicName?: string; studentIds: string[] }) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    const clazz = await prisma.class.findUnique({ where: { id: classId }, select: { assignmentType: true } });
    if (clazz?.assignmentType === AssignmentType.CA_NHAN) {
      throw new BadRequestError("Lớp đang ở loại 'Cá nhân' — vui lòng dùng chức năng gán đề tài cho từng sinh viên");
    }

    // Validate students enrolled & not in another group in same class
    if (data.studentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: data.studentIds } },
        include: {
          enrollments: true,
          groupMemberships: { include: { group: true } },
          user: true,
        },
      });

      if (students.length !== data.studentIds.length) {
        throw new BadRequestError("Một số sinh viên không tồn tại");
      }

      for (const s of students) {
        if (!s.enrollments.some(e => e.classId === classId)) {
          throw new BadRequestError(`Sinh viên '${s.user.fullName}' không đăng ký lớp học phần này`);
        }
        if (s.groupMemberships.some(gm => gm.group.classId === classId)) {
          throw new BadRequestError(`Sinh viên '${s.user.fullName}' đã thuộc nhóm khác trong lớp này`);
        }
      }
    }

    return await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: data.name,
          topicName: data.topicName || '',
          classId,
        },
      });

      if (data.studentIds.length > 0) {
        await tx.groupMember.createMany({
          data: data.studentIds.map(studentId => ({
            groupId: group.id,
            studentId,
          })),
        });
      }

      return group;
    });
  }

  /**
   * Sửa tên nhóm
   */
  async updateGroupName(groupId: string, teacherId: string, name: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    return await prisma.group.update({
      where: { id: groupId },
      data: { name },
    });
  }

  /**
   * Xóa nhóm — chặn nếu đã có submission
   */
  async deleteGroup(groupId: string, teacherId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { submissions: { select: { id: true } } },
    });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    if (group.submissions.length > 0) {
      throw new BadRequestError("Không thể xóa nhóm đã có bài nộp");
    }

    return await prisma.group.delete({ where: { id: groupId } });
  }

  /**
   * Thêm SV vào nhóm
   */
  async addMember(groupId: string, teacherId: string, studentId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    // Check enrolled
    const enrollment = await academicRepository.findEnrollment(studentId, group.classId);
    if (!enrollment) {
      throw new BadRequestError("Sinh viên không đăng ký lớp học phần này");
    }

    // Check not in another group in same class
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        studentId,
        group: { classId: group.classId },
      },
    });
    if (existingMembership) {
      throw new BadRequestError("Sinh viên đã thuộc nhóm khác trong lớp này");
    }

    return await prisma.groupMember.create({
      data: { groupId, studentId },
    });
  }

  /**
   * Gỡ SV khỏi nhóm
   */
  async removeMember(groupId: string, teacherId: string, studentId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
    });
    if (!membership) {
      throw new NotFoundError("Sinh viên không thuộc nhóm này");
    }

    return await prisma.groupMember.delete({
      where: { id: membership.id },
    });
  }

  /**
   * Cập nhật đề tài
   */
  async updateGroupTopic(groupId: string, teacherId: string, topicName: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Không tìm thấy nhóm");

    await this.verifyOwnership(group.classId, teacherId);
    await academicService.verifyTermActive(group.classId);

    return await prisma.group.update({
      where: { id: groupId },
      data: { topicName },
    });
  }

  /**
   * UC mở rộng: lớp loại CA_NHAN — GV gán trực tiếp 1 đề tài cho 1 SV.
   * Tự tạo Group size=1 (SV là leader) để pipeline submission/grading dùng chung.
   */
  async assignTopicToStudent(
    classId: string,
    teacherId: string,
    data: { studentId: string; topicName: string; description?: string },
  ) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    const clazz = await prisma.class.findUnique({ where: { id: classId } });
    if (!clazz) throw new NotFoundError("Không tìm thấy lớp học phần");
    if (clazz.assignmentType !== AssignmentType.CA_NHAN) {
      throw new BadRequestError("Lớp không ở loại 'Cá nhân' — không thể dùng chức năng này");
    }

    const topicName = (data.topicName ?? '').trim();
    if (!topicName) throw new BadRequestError("Tên đề tài không được để trống");

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        user: true,
        enrollments: true,
        groupMemberships: { include: { group: true } },
      },
    });
    if (!student) throw new NotFoundError("Không tìm thấy sinh viên");
    if (!student.enrollments.some(e => e.classId === classId)) {
      throw new BadRequestError(`Sinh viên '${student.user.fullName}' không đăng ký lớp này`);
    }
    if (student.groupMemberships.some(gm => gm.group.classId === classId)) {
      throw new BadRequestError(`Sinh viên '${student.user.fullName}' đã được gán đề tài trong lớp này`);
    }

    return await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: student.studentCode ?? student.user.fullName ?? 'Cá nhân',
          topicName,
          classId,
        },
      });
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          studentId: student.id,
          isLeader: true,
        },
      });
      return group;
    });
  }

  /**
   * Tự động chia nhóm
   */
  async autoGenerateGroups(classId: string, teacherId: string, targetSize: number) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    const clazz = await prisma.class.findUnique({ where: { id: classId }, select: { assignmentType: true } });
    if (clazz?.assignmentType === AssignmentType.CA_NHAN) {
      throw new BadRequestError("Lớp đang ở loại 'Cá nhân' — không hỗ trợ tự động chia nhóm");
    }

    // Lấy SV chưa có nhóm trong LHP
    const enrollments = await academicRepository.getStudentsByClassId(classId);
    const ungroupedStudentIds = enrollments
      .filter(e => !e.student.groupMemberships.some(gm => gm.group.classId === classId))
      .map(e => e.student.id);

    if (ungroupedStudentIds.length === 0) {
      throw new BadRequestError("Tất cả sinh viên đã có nhóm trong lớp này");
    }

    // Tính số nhóm cần tạo
    const groupCount = Math.ceil(ungroupedStudentIds.length / targetSize);

    // Tìm số nhóm hiện có để đánh số tiếp
    const existingGroups = await prisma.group.count({ where: { classId } });

    const createdGroups: any[] = [];

    return await prisma.$transaction(async (tx) => {
      for (let i = 0; i < groupCount; i++) {
        const start = i * targetSize;
        const end = Math.min(start + targetSize, ungroupedStudentIds.length);
        const memberIds = ungroupedStudentIds.slice(start, end);

        const group = await tx.group.create({
          data: {
            name: `Nhóm ${existingGroups + i + 1}`,
            topicName: '',
            classId,
          },
        });

        await tx.groupMember.createMany({
          data: memberIds.map(studentId => ({
            groupId: group.id,
            studentId,
          })),
        });

        createdGroups.push({
          ...group,
          memberCount: memberIds.length,
        });
      }

      return createdGroups;
    });
  }
  /**
   * Import hàng loạt nhóm và thành viên từ Excel/CSV
   */
  async importGroupsBatch(classId: string, teacherId: string, groupsData: { name: string, topicName?: string, studentCodes: string[] }[]) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    // Lấy toàn bộ SV trong lớp để map studentCode -> studentId
    const enrollments = await academicRepository.getStudentsByClassId(classId);
    
    // Map sinh viên với thông tin nhóm hiện tại
    const studentMap = new Map<string, { id: string, hasGroup: boolean }>();
    for (const e of enrollments) {
      const hasGroup = e.student.groupMemberships.some(gm => gm.group.classId === classId);
      studentMap.set(e.student.studentCode.toUpperCase(), { id: e.student.id, hasGroup });
    }

    return await prisma.$transaction(async (tx) => {
      const createdGroups: any[] = [];

      for (const groupInput of groupsData) {
        // Validate và lấy student IDs
        const validStudentIds: string[] = [];
        
        for (const code of groupInput.studentCodes) {
          const upperCode = code.trim().toUpperCase();
          const studentInfo = studentMap.get(upperCode);
          if (!studentInfo) {
            throw new BadRequestError(`Sinh viên có mã '${code}' không đăng ký lớp học phần này`);
          }
          if (studentInfo.hasGroup) {
            throw new BadRequestError(`Sinh viên có mã '${code}' đã thuộc nhóm khác trong lớp này`);
          }
          validStudentIds.push(studentInfo.id);
          
          // Mark as having group to prevent duplicates in the same file
          studentInfo.hasGroup = true;
          studentMap.set(upperCode, studentInfo);
        }

        // Tạo nhóm
        const group = await tx.group.create({
          data: {
            name: groupInput.name,
            topicName: groupInput.topicName || '',
            classId,
          },
        });

        // Thêm thành viên
        if (validStudentIds.length > 0) {
          await tx.groupMember.createMany({
            data: validStudentIds.map(studentId => ({
              groupId: group.id,
              studentId,
            })),
          });
        }

        createdGroups.push({
          ...group,
          memberCount: validStudentIds.length
        });
      }

      return createdGroups;
    });
  }

  /**
   * Import nhóm + thành viên + nhóm trưởng từ file Excel (DanhSachSinhVien_CNPM.xlsx).
   * - Sheet "Điểm Danh": header tại row 7, data từ row 8
   * - Cột: A=STT, B=MSSV, C=Họ lót, D=Tên, E=Nhóm, F=Tên nhóm, G=Đề tài
   * - Nhóm trưởng: chữ in đỏ (font color ARGB FFFF0000) ở cột C/D
   * - Forward-fill: cột E/F/G chỉ điền ở dòng đầu mỗi nhóm
   * - SV chưa có trong DB: auto-tạo User (mustChangePassword=true) + Student + ClassEnrollment
   */
  async importGroupsFromExcel(classId: string, teacherId: string, fileBuffer: Buffer) {
    await this.verifyOwnership(classId, teacherId);
    await academicService.verifyTermActive(classId);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const sheet =
      workbook.getWorksheet('Điểm Danh') ||
      workbook.getWorksheet('Diem Danh') ||
      workbook.worksheets[0];
    if (!sheet) throw new BadRequestError('File Excel không có sheet nào');

    // Sheet "Điểm Thi" (nếu có) chứa cột H "Tên đề tài" là tiêu đề mô tả dài.
    // Khớp theo row number với "Điểm Danh" — ưu tiên dùng cột H làm topicName, fallback cột G "Đề tài".
    const examSheet =
      workbook.getWorksheet('Điểm Thi') ||
      workbook.getWorksheet('Diem Thi') ||
      null;

    type ParsedMember = { studentCode: string; fullName: string; isLeader: boolean };
    type ParsedGroup = { groupNo: number; name: string; topicName: string; members: ParsedMember[] };

    const groupsByNo = new Map<number, ParsedGroup>();
    let currentGroupNo: number | null = null;
    const seenCodes = new Set<string>();

    const HEADER_ROW = 7;
    // BUG FIX: `actualRowCount` của ExcelJS đếm SỐ dòng có dữ liệu, không phải INDEX dòng cuối.
    // Nếu file có dòng trống ở giữa (vd row 3, row 6 chỉ chứa label-merge), actualRowCount < rowCount
    // → loop sẽ bỏ qua các SV cuối file. Dùng max của 2 giá trị để chắc chắn lặp tới dòng cuối thực sự.
    const lastRow = Math.max(sheet.actualRowCount || 0, sheet.rowCount || 0);

    for (let r = HEADER_ROW + 1; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      const mssvCell = row.getCell(2);
      const mssv = (mssvCell.value ? String(mssvCell.value).trim() : '');
      if (!mssv) continue;
      if (seenCodes.has(mssv)) {
        throw new BadRequestError(`MSSV trùng trong file: ${mssv}`);
      }
      seenCodes.add(mssv);

      const hoLot = String(row.getCell(3).value ?? '').trim();
      const ten = String(row.getCell(4).value ?? '').trim();
      const fullName = `${hoLot} ${ten}`.replace(/\s+/g, ' ').trim();

      const nhomRaw = row.getCell(5).value;
      const tenNhomRaw = String(row.getCell(6).value ?? '').trim();
      const deTaiCategory = String(row.getCell(7).value ?? '').trim();
      // Ưu tiên "Tên đề tài" (cột H sheet "Điểm Thi") làm topicName; fallback "Đề tài" (cột G sheet "Điểm Danh").
      const tenDeTaiLong = examSheet
        ? String(examSheet.getRow(r).getCell(8).value ?? '').trim()
        : '';
      const deTaiRaw = tenDeTaiLong || deTaiCategory;

      if (nhomRaw !== null && nhomRaw !== undefined && nhomRaw !== '') {
        const n = Number(nhomRaw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new BadRequestError(`Dòng ${r}: số nhóm không hợp lệ (${nhomRaw})`);
        }
        currentGroupNo = n;
        if (!groupsByNo.has(n)) {
          groupsByNo.set(n, {
            groupNo: n,
            name: tenNhomRaw || `Nhóm ${n}`,
            topicName: deTaiRaw,
            members: [],
          });
        } else {
          const g = groupsByNo.get(n)!;
          if (tenNhomRaw) g.name = tenNhomRaw;
          if (deTaiRaw) g.topicName = deTaiRaw;
        }
      }
      if (currentGroupNo === null) {
        throw new BadRequestError(`Dòng ${r}: SV ${mssv} chưa thuộc nhóm nào (số nhóm trống ở dòng đầu)`);
      }

      // Detect leader: cột C hoặc D có font đỏ
      const cFont = row.getCell(3).font;
      const dFont = row.getCell(4).font;
      const isLeader = isRedFont(cFont?.color?.argb) || isRedFont(dFont?.color?.argb);

      groupsByNo.get(currentGroupNo)!.members.push({
        studentCode: mssv.toUpperCase(),
        fullName: fullName || mssv,
        isLeader,
      });
    }

    if (groupsByNo.size === 0) {
      throw new BadRequestError('Không tìm thấy dữ liệu nhóm hợp lệ trong file');
    }

    // Validate: mỗi nhóm tối đa 1 leader (có thể 0 nếu file thiếu)
    for (const g of groupsByNo.values()) {
      const leaders = g.members.filter(m => m.isLeader);
      if (leaders.length > 1) {
        throw new BadRequestError(`Nhóm ${g.groupNo} (${g.name}) có ${leaders.length} nhóm trưởng (chữ đỏ); chỉ được 1`);
      }
    }

    // Check group name conflict với DB
    const existingGroups = await prisma.group.findMany({
      where: { classId, name: { in: [...groupsByNo.values()].map(g => g.name) } },
      select: { name: true },
    });
    if (existingGroups.length > 0) {
      throw new BadRequestError(
        `Các nhóm sau đã tồn tại trong lớp: ${existingGroups.map(g => g.name).join(', ')}`
      );
    }

    // Pre-load students hiện có để biết ai cần auto-create
    const allCodes = [...seenCodes].map(c => c.toUpperCase());
    const existingStudents = await prisma.student.findMany({
      where: { studentCode: { in: allCodes } },
      include: {
        user: { select: { fullName: true } },
        groupMemberships: {
          where: { group: { classId } },
          select: { id: true, group: { select: { name: true } } },
        },
      },
    });
    const studentByCode = new Map(existingStudents.map(s => [s.studentCode.toUpperCase(), s]));

    // SV đã thuộc nhóm khác trong lớp này → từ chối
    const alreadyGrouped = existingStudents.filter(s => s.groupMemberships.length > 0);
    if (alreadyGrouped.length > 0) {
      throw new BadRequestError(
        `Các sinh viên sau đã thuộc nhóm khác trong lớp này: ${alreadyGrouped
          .map(s => `${s.studentCode} (nhóm ${s.groupMemberships[0].group.name})`)
          .join(', ')}`
      );
    }

    // Lấy classCode để generate email default cho SV mới
    const classRecord = await prisma.class.findUnique({ where: { id: classId }, select: { classCode: true } });
    const defaultPasswordHash = await SecurityHelper.hashPassword('123456');

    return await prisma.$transaction(async (tx) => {
      let createdUsersCount = 0;
      let enrolledCount = 0;

      // Auto-create SV còn thiếu
      // Lưu ý: dùng for-loop sequential vì cần include student và tránh race condition trên unique constraints.
      // Vì vậy cần timeout đủ lớn cho file Excel hàng trăm SV (xem option ở cuối $transaction).
      for (const g of groupsByNo.values()) {
        for (const m of g.members) {
          if (studentByCode.has(m.studentCode)) continue;
          const email = `${m.studentCode.toLowerCase()}@stu.local`;
          // Defensive: nếu email/MSSV đã tồn tại do race → skip; nhưng đã check ở trên
          const user = await tx.user.create({
            data: {
              email,
              password: defaultPasswordHash,
              fullName: m.fullName,
              role: 'STUDENT',
              isActive: true,
              mustChangePassword: true,
              student: {
                create: { studentCode: m.studentCode },
              },
            },
            include: { student: true },
          });
          createdUsersCount++;
          studentByCode.set(m.studentCode, {
            ...user.student!,
            user: { fullName: user.fullName },
            groupMemberships: [],
          } as any);
        }
      }

      // Đảm bảo tất cả SV đã enroll vào class
      const studentIds = [...studentByCode.values()].map(s => s.id);
      const existingEnrollments = await tx.classEnrollment.findMany({
        where: { classId, studentId: { in: studentIds } },
        select: { studentId: true },
      });
      const enrolledIds = new Set(existingEnrollments.map(e => e.studentId));
      const toEnroll = studentIds.filter(id => !enrolledIds.has(id));
      if (toEnroll.length > 0) {
        await tx.classEnrollment.createMany({
          data: toEnroll.map(studentId => ({ studentId, classId })),
        });
        enrolledCount = toEnroll.length;
      }

      // Tạo Group + GroupMember (kèm isLeader)
      const createdGroups: any[] = [];
      for (const g of [...groupsByNo.values()].sort((a, b) => a.groupNo - b.groupNo)) {
        const group = await tx.group.create({
          data: { name: g.name, topicName: g.topicName || '', classId },
        });
        await tx.groupMember.createMany({
          data: g.members.map(m => ({
            groupId: group.id,
            studentId: studentByCode.get(m.studentCode)!.id,
            isLeader: m.isLeader,
          })),
        });
        createdGroups.push({
          id: group.id,
          groupNo: g.groupNo,
          name: g.name,
          topicName: g.topicName,
          memberCount: g.members.length,
          leaderCode: g.members.find(m => m.isLeader)?.studentCode ?? null,
        });
      }

      return {
        classCode: classRecord?.classCode ?? null,
        groupCount: createdGroups.length,
        memberCount: createdGroups.reduce((s, g) => s + g.memberCount, 0),
        leaderCount: createdGroups.filter(g => g.leaderCode).length,
        createdUsersCount,
        enrolledCount,
        groups: createdGroups,
      };
    }, {
      // Default Prisma timeout = 5s. Với file Excel hàng trăm SV (mỗi user.create là 1 round-trip)
      // dễ vượt 5s → transaction bị đóng giữa chừng (lỗi "Transaction not found").
      maxWait: 15_000,   // chờ tối đa 15s để lấy được kết nối
      timeout: 120_000,  // cho phép transaction chạy tới 2 phút
    });
  }
}

export const teacherService = new TeacherService();
