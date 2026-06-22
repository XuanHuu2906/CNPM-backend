import { PrismaClient } from '@prisma/client';

// Monkey-patch enums (must be done before using @prisma/client enums)
const prismaModule = require('@prisma/client');
prismaModule.UserRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  ACADEMIC_DEPT: 'ACADEMIC_DEPT',
};
prismaModule.SubmissionStatus = {
  CHUA_NOP: 'CHUA_NOP',
  DA_NOP: 'DA_NOP',
  DANG_CHAM: 'DANG_CHAM',
  YEU_CAU_SUA: 'YEU_CAU_SUA',
  TU_CHOI: 'TU_CHOI',
  DA_CHAM: 'DA_CHAM',
  HOAN_THANH: 'HOAN_THANH',
};

const { UserRole, SubmissionStatus } = prismaModule;

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting rich database seeding...');

  // 1. Clean up old data in FK-safe order (children before parents)
  await prisma.detailedScore.deleteMany().catch(() => {});
  await prisma.resubmissionRequest.deleteMany().catch(() => {});
  await prisma.comment.deleteMany().catch(() => {});
  await prisma.approval.deleteMany().catch(() => {});
  await prisma.editRequest.deleteMany().catch(() => {});
  await prisma.grade.deleteMany().catch(() => {});
  await prisma.submissionLog.deleteMany().catch(() => {});
  await prisma.submission.deleteMany().catch(() => {});
  await prisma.criteria.deleteMany().catch(() => {});
  await prisma.rubric.deleteMany().catch(() => {});
  await prisma.assignment.deleteMany().catch(() => {});
  await prisma.assignmentHistory.deleteMany().catch(() => {});
  await prisma.classEnrollment.deleteMany().catch(() => {});
  await prisma.student.deleteMany().catch(() => {});
  await prisma.groupMember.deleteMany().catch(() => {});
  await prisma.group.deleteMany().catch(() => {});
  await prisma.class.deleteMany().catch(() => {});
  await prisma.academicTerm.deleteMany().catch(() => {});
  await prisma.subject.deleteMany().catch(() => {});
  await prisma.teacher.deleteMany().catch(() => {});
  await prisma.academicDept.deleteMany().catch(() => {});
  await prisma.admin.deleteMany().catch(() => {});
  await prisma.systemLog.deleteMany().catch(() => {});
  await prisma.systemConfig.deleteMany().catch(() => {});
  await prisma.notification.deleteMany().catch(() => {});
  await prisma.passwordResetToken.deleteMany().catch(() => {});
  await prisma.backup.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});
  await prisma.faculty.deleteMany().catch(() => {});
  await prisma.role.deleteMany().catch(() => {});
  await prisma.reportStatus.deleteMany().catch(() => {});
  await prisma.topic.deleteMany().catch(() => {});
  await prisma.reportFile.deleteMany().catch(() => {});
  await prisma.submissionHistory.deleteMany().catch(() => {});

  console.log('🧹 Cleaned up old database tables safely.');

  // Default password: Password123@
  const bcrypt = require('bcryptjs');
  const defaultPasswordHash = await bcrypt.hash('Password123@', 10);

  // ==========================================
  // 2. CREATE USER ACCOUNTS
  // ==========================================

  // Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'Trần Văn Quản Trị',
      phoneNumber: '0901234567',
      role: UserRole.ADMIN,
      admin: {
        create: { employeeCode: 'ADM001' },
      },
    },
  });
  console.log('👤 Created Admin account.');

  // Academic Dept (PDT)
  const deptUser = await prisma.user.create({
    data: {
      email: 'pdt@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'Nguyễn Đào Tạo',
      phoneNumber: '0907654321',
      role: UserRole.ACADEMIC_DEPT,
      academicDept: {
        create: { employeeCode: 'PDT001' },
      },
    },
  });
  console.log('👤 Created Academic Dept account.');

  // Teachers (8 teachers: 3 CNPM, 2 HTTT, 3 KTMT to fit frontend email-heuristics)
  // CNPM Teachers (gv.cnpm... -> CNPM)
  const tUserCnpm1 = await prisma.user.create({
    data: {
      email: 'gv.cnpm1@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'PGS.TS Nguyễn Văn A',
      phoneNumber: '0912233445',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_CNPM01', title: 'PGS.TS' } },
    },
  });
  const tUserCnpm2 = await prisma.user.create({
    data: {
      email: 'gv.cnpm2@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'ThS Lê Thị B',
      phoneNumber: '0913344556',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_CNPM02', title: 'ThS' } },
    },
  });
  const tUserCnpm3 = await prisma.user.create({
    data: {
      email: 'gv.cnpm3@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'TS Trần Văn C',
      phoneNumber: '0914455667',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_CNPM03', title: 'TS' } },
    },
  });

  // HTTT Teachers (gv.httt... -> HTTT)
  const tUserHttt1 = await prisma.user.create({
    data: {
      email: 'gv.httt1@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'ThS Nguyễn Thị D',
      phoneNumber: '0915566778',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_HTTT01', title: 'ThS' } },
    },
  });
  const tUserHttt2 = await prisma.user.create({
    data: {
      email: 'gv.httt2@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'TS Phạm Văn E',
      phoneNumber: '0916677889',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_HTTT02', title: 'TS' } },
    },
  });

  // KTMT Teachers (gv.ktmt... -> KTMT)
  const tUserKtmt1 = await prisma.user.create({
    data: {
      email: 'gv.ktmt1@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'PGS.TS Hoàng Văn F',
      phoneNumber: '0917788990',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_KTMT01', title: 'PGS.TS' } },
    },
  });
  const tUserKtmt2 = await prisma.user.create({
    data: {
      email: 'gv.ktmt2@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'ThS Vũ Thị G',
      phoneNumber: '0918899001',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_KTMT02', title: 'ThS' } },
    },
  });
  const tUserKtmt3 = await prisma.user.create({
    data: {
      email: 'gv.ktmt3@school.edu.vn',
      password: defaultPasswordHash,
      fullName: 'TS Đỗ Văn H',
      phoneNumber: '0919900112',
      role: UserRole.TEACHER,
      teacher: { create: { teacherCode: 'GV_KTMT03', title: 'TS' } },
    },
  });

  // Fetch Teacher objects
  const tCnpm1 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserCnpm1.id } });
  const tCnpm2 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserCnpm2.id } });
  const tCnpm3 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserCnpm3.id } });
  const tHttt1 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserHttt1.id } });
  const tHttt2 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserHttt2.id } });
  const tKtmt1 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserKtmt1.id } });
  const tKtmt2 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserKtmt2.id } });
  const tKtmt3 = await prisma.teacher.findUniqueOrThrow({ where: { userId: tUserKtmt3.id } });

  console.log('👤 Created 8 Teacher accounts.');

  // ==========================================
  // 3. CREATE ACADEMIC TERMS & SUBJECTS
  // ==========================================

  const termLocked = await prisma.academicTerm.create({
    data: {
      name: 'HK1-2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-01-15'),
      isLocked: true,
    },
  });

  const termActive = await prisma.academicTerm.create({
    data: {
      name: 'HK2-2025-2026',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-06-30'),
      isLocked: false,
    },
  });
  console.log('📅 Created 2 Academic Terms (1 locked, 1 active).');

  // Subjects (SE -> CNPM, IS -> HTTT, CS or others -> KTMT)
  const subSe301 = await prisma.subject.create({
    data: { subjectCode: 'SE301', name: 'Thiết kế phần mềm hướng đối tượng' },
  });
  const subSe302 = await prisma.subject.create({
    data: { subjectCode: 'SE302', name: 'Đảm bảo chất lượng phần mềm' },
  });
  const subSe303 = await prisma.subject.create({
    data: { subjectCode: 'SE303', name: 'Nhập môn Công nghệ phần mềm' },
  });
  const subIs201 = await prisma.subject.create({
    data: { subjectCode: 'IS201', name: 'Cơ sở dữ liệu nâng cao' },
  });
  const subIs202 = await prisma.subject.create({
    data: { subjectCode: 'IS202', name: 'Phân tích thiết kế hệ thống' },
  });
  const subCs101 = await prisma.subject.create({
    data: { subjectCode: 'CS101', name: 'Kiến trúc máy tính' },
  });
  const subCs102 = await prisma.subject.create({
    data: { subjectCode: 'CS102', name: 'Hệ điều hành' },
  });
  console.log('📚 Created 7 Subjects across CNPM, HTTT, KTMT departments.');

  // ==========================================
  // 4. CREATE CLASSES
  // ==========================================

  // HK2-2025-2026 (Active) Classes
  const classSe301_L01 = await prisma.class.create({
    data: { classCode: 'SE301_L01', subjectId: subSe301.id, termId: termActive.id },
  });
  const classSe301_L02 = await prisma.class.create({
    data: { classCode: 'SE301_L02', subjectId: subSe301.id, termId: termActive.id },
  });
  const classSe302_L01 = await prisma.class.create({
    data: { classCode: 'SE302_L01', subjectId: subSe302.id, termId: termActive.id }, // Unassigned
  });
  const classSe303_L01 = await prisma.class.create({
    data: { classCode: 'SE303_L01', subjectId: subSe303.id, termId: termActive.id }, // Unassigned
  });
  const classIs201_L01 = await prisma.class.create({
    data: { classCode: 'IS201_L01', subjectId: subIs201.id, termId: termActive.id },
  });
  const classIs202_L01 = await prisma.class.create({
    data: { classCode: 'IS202_L01', subjectId: subIs202.id, termId: termActive.id }, // Unassigned
  });
  const classCs101_L01 = await prisma.class.create({
    data: { classCode: 'CS101_L01', subjectId: subCs101.id, termId: termActive.id },
  });
  const classCs101_L02 = await prisma.class.create({
    data: { classCode: 'CS101_L02', subjectId: subCs101.id, termId: termActive.id }, // Unassigned
  });
  const classCs102_L01 = await prisma.class.create({
    data: { classCode: 'CS102_L01', subjectId: subCs102.id, termId: termActive.id }, // Unassigned
  });

  // HK1-2025-2026 (Locked) Classes
  const classSe301_L03 = await prisma.class.create({
    data: { classCode: 'SE301_L03', subjectId: subSe301.id, termId: termLocked.id },
  });
  const classIs201_L02 = await prisma.class.create({
    data: { classCode: 'IS201_L02', subjectId: subIs201.id, termId: termLocked.id },
  });

  console.log('🏫 Created 11 Classes (9 active, 2 locked).');

  // ==========================================
  // 5. ASSIGN TEACHERS TO CLASSES
  // ==========================================

  await prisma.assignment.createMany({
    data: [
      { classId: classSe301_L01.id, teacherId: tCnpm1.id },
      { classId: classSe301_L02.id, teacherId: tCnpm2.id },
      { classId: classIs201_L01.id, teacherId: tHttt1.id },
      { classId: classCs101_L01.id, teacherId: tKtmt1.id },
      { classId: classSe301_L03.id, teacherId: tCnpm1.id }, // Locked class
      { classId: classIs201_L02.id, teacherId: tHttt2.id }, // Locked class
    ],
  });
  console.log('📝 Assigned Teachers to 6 classes. 5 classes remain unassigned for testing recommendation algorithms.');

  // ==========================================
  // 6. CREATE STUDENTS & GROUPS
  // ==========================================

  // Student accounts and detailed objects
  const studentsData = [
    { email: 'sv1@school.edu.vn', fullName: 'Nguyễn Văn Nam', code: '22010151', classId: classSe301_L01.id },
    { email: 'sv2@school.edu.vn', fullName: 'Trần Thị Mai', code: '22010152', classId: classSe301_L01.id },
    { email: 'sv3@school.edu.vn', fullName: 'Phan Thanh Bình', code: '22010153', classId: classSe301_L01.id },
    { email: 'sv4@school.edu.vn', fullName: 'Lê Hoàng Yến', code: '22010154', classId: classSe301_L01.id },
    { email: 'sv5@school.edu.vn', fullName: 'Vũ Minh Triết', code: '22010155', classId: classSe301_L01.id },
    { email: 'sv6@school.edu.vn', fullName: 'Ngô Bích Vân', code: '22010156', classId: classSe301_L01.id },
    { email: 'sv7@school.edu.vn', fullName: 'Đặng Anh Tuấn', code: '22010157', classId: classSe301_L02.id },
    { email: 'sv8@school.edu.vn', fullName: 'Phạm Minh Ngọc', code: '22010158', classId: classSe301_L02.id },
    { email: 'sv9@school.edu.vn', fullName: 'Đỗ Minh Khang', code: '22010159', classId: classIs201_L01.id },
    { email: 'sv10@school.edu.vn', fullName: 'Nguyễn Thanh Lâm', code: '22010160', classId: classIs201_L01.id },
    { email: 'sv11@school.edu.vn', fullName: 'Trịnh Xuân Bách', code: '22010161', classId: classCs101_L01.id },
    { email: 'sv12@school.edu.vn', fullName: 'Bùi Hữu Đạt', code: '22010162', classId: classCs101_L01.id },
    { email: 'sv13@school.edu.vn', fullName: 'Đoàn Thu Hà', code: '22010163', classId: classCs101_L01.id },
    { email: 'sv14@school.edu.vn', fullName: 'Lâm Quang Vinh', code: '22010164', classId: classCs101_L01.id },
    { email: 'sv15@school.edu.vn', fullName: 'Vương Quốc Bảo', code: '22010165', classId: classCs101_L01.id },
  ];

  const students: any[] = [];
  for (const s of studentsData) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        password: defaultPasswordHash,
        fullName: s.fullName,
        role: UserRole.STUDENT,
        student: {
          create: {
            studentCode: s.code,
          },
        },
      },
    });
    const student = await prisma.student.findUniqueOrThrow({ where: { userId: user.id } });
    // Create ClassEnrollment to link student to class
    await prisma.classEnrollment.create({
      data: {
        studentId: student.id,
        classId: s.classId,
      },
    });
    students.push({ ...student, user });
  }
  console.log('👤 Created 15 Student accounts across different classes.');

  // UC-13 / S5: tất cả tài khoản seed đều dùng mật khẩu mặc định cố định Password123@ —
  // bật mustChangePassword để FE buộc đổi mật khẩu lần đăng nhập đầu tiên.
  await prisma.user.updateMany({
    data: { mustChangePassword: true },
  });
  console.log('🔐 Flagged all seeded accounts as mustChangePassword=true.');

  // Create Groups for SE301_L01
  const grp1 = await prisma.group.create({
    data: { name: 'Nhom 1', topicName: 'Xây dựng ứng dụng quản lý rạp chiếu phim', classId: classSe301_L01.id },
  });
  const grp2 = await prisma.group.create({
    data: { name: 'Nhom 2', topicName: 'Hệ thống đặt xe công nghệ trực tuyến', classId: classSe301_L01.id },
  });
  const grp3 = await prisma.group.create({
    data: { name: 'Nhom 3', topicName: 'Website thương mại điện tử nông sản', classId: classSe301_L01.id },
  });

  // Create Group for IS201_L01
  const grp4 = await prisma.group.create({
    data: { name: 'Nhom 1', topicName: 'Phân tích hành vi mua sắm khách hàng', classId: classIs201_L01.id },
  });

  // Assign Students to Groups via GroupMember
  await prisma.groupMember.createMany({
    data: [
      { groupId: grp1.id, studentId: students[0].id },
      { groupId: grp1.id, studentId: students[1].id },
      { groupId: grp2.id, studentId: students[2].id },
      { groupId: grp2.id, studentId: students[3].id },
      { groupId: grp3.id, studentId: students[4].id },
      { groupId: grp3.id, studentId: students[5].id },
      { groupId: grp4.id, studentId: students[8].id },
      { groupId: grp4.id, studentId: students[9].id },
    ],
  });

  console.log('👥 Structured students into 4 distinct groups.');

  // ==========================================
  // 7. CREATE RUBRICS WITH CRITERIA
  // ==========================================

  // Rubric 1 (PGS.TS Nguyễn Văn A - CNPM)
  const rubCnpm = await prisma.rubric.create({
    data: {
      title: 'Rubric Báo Cáo Đề Tài Cuối Kỳ - CNPM',
      description: 'Tiêu chí đánh giá chung đề tài môn Thiết kế phần mềm hướng đối tượng',
      teacherId: tCnpm1.id,
      criteria: {
        create: [
          { name: 'Nội dung kỹ thuật', description: 'Kiến trúc phần mềm, mẫu thiết kế áp dụng', maxScore: 10.0, weight: 40.0 },
          { name: 'Bố cục tài liệu', description: 'Trình bày tài liệu đặc tả, sơ đồ UML', maxScore: 10.0, weight: 30.0 },
          { name: 'Thuyết trình & Hỏi đáp', description: 'Kỹ năng thuyết trình nhóm và giải trình câu hỏi', maxScore: 10.0, weight: 30.0 },
        ],
      },
    },
  });

  // Rubric 2 (ThS Nguyễn Thị D - HTTT)
  const rubHttt = await prisma.rubric.create({
    data: {
      title: 'Rubric Đồ Án Cơ Sở Dữ Liệu - HTTT',
      description: 'Đánh giá đồ án môn Cơ sở dữ liệu nâng cao',
      teacherId: tHttt1.id,
      criteria: {
        create: [
          { name: 'Thiết kế E-R và Lược đồ', description: 'Mức độ tối ưu hóa lược đồ thực thể', maxScore: 10.0, weight: 40.0 },
          { name: 'Truy vấn và Tối ưu hóa SQL', description: 'Viết Trigger, Stored Procedure, Index', maxScore: 10.0, weight: 45.0 },
          { name: 'Báo cáo tổng hợp', description: 'Quy chuẩn tài liệu phân tích hệ thống', maxScore: 10.0, weight: 15.0 },
        ],
      },
    },
  });

  // Rubric 3 (PGS.TS Hoàng Văn F - KTMT)
  const rubKtmt = await prisma.rubric.create({
    data: {
      title: 'Rubric Thực Hành Kiến Trúc Máy Tính - KTMT',
      description: 'Chấm báo cáo thực hành KTMT',
      teacherId: tKtmt1.id,
      criteria: {
        create: [
          { name: 'Bài thực hành Assembly', description: 'Mã assembly MIPS chạy đúng yêu cầu', maxScore: 10.0, weight: 50.0 },
          { name: 'Thiết kế mạch Logisim', description: 'Mạch logic hoạt động trơn tru', maxScore: 10.0, weight: 35.0 },
          { name: 'Báo cáo lý thuyết', description: 'Hiểu bài và giải thích mạch rõ ràng', maxScore: 10.0, weight: 15.0 },
        ],
      },
    },
  });

  const cCnpm = await prisma.criteria.findMany({ where: { rubricId: rubCnpm.id } });
  const cHttt = await prisma.criteria.findMany({ where: { rubricId: rubHttt.id } });
  const cKtmt = await prisma.criteria.findMany({ where: { rubricId: rubKtmt.id } });

  console.log('🎯 Created 3 detailed Rubrics for CNPM, HTTT, KTMT.');

  // ==========================================
  // 8. CREATE SUBMISSIONS & GRADES
  // ==========================================

  // 1. Group 1 (SE301_L01) -> HOAN_THANH (completed, approved score)
  const sub1 = await prisma.submission.create({
    data: {
      groupId: grp1.id,
      filePath: '/uploads/reports/se301_l01_group1_final.pdf',
      attachments: '/uploads/reports/se301_l01_group1_src.zip',
      status: SubmissionStatus.HOAN_THANH,
      version: 1,
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
  });
  // Create Grade for sub1
  const grade1Detailed = [
    { criteriaId: cCnpm[0].id, score: 8.5 },
    { criteriaId: cCnpm[1].id, score: 9.0 },
    { criteriaId: cCnpm[2].id, score: 8.0 },
  ];
  await prisma.grade.create({
    data: {
      submissionId: sub1.id,
      rubricId: rubCnpm.id,
      teacherId: tCnpm1.id,
      detailedScores: JSON.stringify(grade1Detailed),
      finalScore: 8.5,
      feedback: 'Báo cáo trình bày xuất sắc, đáp ứng đầy đủ yêu cầu hệ thống đề ra, thuyết trình trôi chảy.',
      isApproved: true,
      approvedById: deptUser.id,
      version: 1,
    },
  });

  // 2. Group 2 (SE301_L01) -> DA_CHAM (graded, waiting approval)
  const sub2 = await prisma.submission.create({
    data: {
      groupId: grp2.id,
      filePath: '/uploads/reports/se301_l01_group2_draft.pdf',
      attachments: '/uploads/reports/se301_l01_group2_demo.mp4',
      status: SubmissionStatus.DA_CHAM,
      version: 1,
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
  });
  // Create Grade for sub2 (unapproved)
  const grade2Detailed = [
    { criteriaId: cCnpm[0].id, score: 7.0 },
    { criteriaId: cCnpm[1].id, score: 7.0 },
    { criteriaId: cCnpm[2].id, score: 7.0 },
  ];
  await prisma.grade.create({
    data: {
      submissionId: sub2.id,
      rubricId: rubCnpm.id,
      teacherId: tCnpm1.id,
      detailedScores: JSON.stringify(grade2Detailed),
      finalScore: 7.0,
      feedback: 'Bản vẽ thiết kế còn một số sai sót, cần chú ý chuẩn hóa các sơ đồ UML.',
      isApproved: false,
      version: 1,
    },
  });

  // 3. Group 3 (SE301_L01) -> DANG_CHAM (grading in progress)
  const sub3 = await prisma.submission.create({
    data: {
      groupId: grp3.id,
      filePath: '/uploads/reports/se301_l01_group3_v2.pdf',
      status: SubmissionStatus.DANG_CHAM,
      version: 1,
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // 4. Student 7 (SE301_L02) -> YEU_CAU_SUA (needs edits)
  const sub4 = await prisma.submission.create({
    data: {
      studentId: students[6].id, // sv7
      filePath: '/uploads/reports/se301_l02_sv7.pdf',
      status: SubmissionStatus.YEU_CAU_SUA,
      version: 1,
      editRequestNote: 'Cần vẽ lại sơ đồ tuần tự (Sequence Diagram) cho đúng chuẩn và bổ sung kiểm thử biên.',
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  // 5. Student 8 (SE301_L02) -> DA_NOP (waiting to be graded)
  const sub5 = await prisma.submission.create({
    data: {
      studentId: students[7].id, // sv8
      filePath: '/uploads/reports/se301_l02_sv8.pdf',
      status: SubmissionStatus.DA_NOP,
      version: 1,
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // 6. Group 4 (IS201_L01) -> TU_CHOI (rejected due to copy-paste)
  const sub6 = await prisma.submission.create({
    data: {
      groupId: grp4.id,
      filePath: '/uploads/reports/is201_l01_group4.pdf',
      status: SubmissionStatus.TU_CHOI,
      version: 1,
      rejectReason: 'Báo cáo bị phát hiện sao chép tài liệu khóa trước trên 50%.',
      submittedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  });

  // 7. Student 11 (CS101_L01) -> DA_NOP (waiting grade)
  const sub7 = await prisma.submission.create({
    data: {
      studentId: students[10].id, // sv11
      filePath: '/uploads/reports/cs101_l01_sv11.pdf',
      status: SubmissionStatus.DA_NOP,
      version: 1,
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // 8. Student 13 (CS101_L01) -> HOAN_THANH (completed & approved grade)
  const sub8 = await prisma.submission.create({
    data: {
      studentId: students[12].id, // sv13
      filePath: '/uploads/reports/cs101_l01_sv13.pdf',
      status: SubmissionStatus.HOAN_THANH,
      version: 1,
      submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });
  // Create Grade for sub8
  const grade8Detailed = [
    { criteriaId: cKtmt[0].id, score: 9.5 },
    { criteriaId: cKtmt[1].id, score: 9.0 },
    { criteriaId: cKtmt[2].id, score: 10.0 },
  ];
  await prisma.grade.create({
    data: {
      submissionId: sub8.id,
      rubricId: rubKtmt.id,
      teacherId: tKtmt1.id,
      detailedScores: JSON.stringify(grade8Detailed),
      finalScore: 9.4,
      feedback: 'Phần mô phỏng tập lệnh MIPS chạy rất tốt, lập trình mạch Logisim tối ưu và sáng tạo.',
      isApproved: true,
      approvedById: deptUser.id,
      version: 1,
    },
  });

  // 9. Student 14 (CS101_L01) -> CHUA_NOP (empty state)
  const sub9 = await prisma.submission.create({
    data: {
      studentId: students[13].id, // sv14
      filePath: '',
      status: SubmissionStatus.CHUA_NOP,
      version: 1,
    },
  });

  console.log('📄 Created 9 Submissions with varying statuses and 3 Grades.');

  // ==========================================
  // 9. CREATE RESUBMISSION REQUESTS
  // ==========================================

  // Request 1: Active and waiting for review (Student 7 for Sub 4)
  await prisma.resubmissionRequest.create({
    data: {
      submissionId: sub4.id,
      studentId: students[6].id, // sv7
      reason: 'Em đã bổ sung biểu đồ tuần tự đúng chuẩn UML và thêm các trường hợp biên của test case như thầy đề xuất ạ. Mong thầy xem xét cho em nộp lại.',
      status: 'CHO_XU_LY',
    },
  });

  // Request 2: Rejected resubmission (Group 4 for Sub 6)
  await prisma.resubmissionRequest.create({
    data: {
      submissionId: sub6.id,
      studentId: students[8].id, // sv9 from group 4
      reason: 'Nhóm chúng em xin lỗi thầy vì sự thiếu trung thực. Chúng em đã tự viết lại toàn bộ nội dung báo cáo mới độc lập 100%. Mong thầy cho chúng em nộp lại bài.',
      status: 'TU_CHOI',
      reviewerId: tHttt1.id,
      feedbackNote: 'Yêu cầu nộp lại bị từ chối do vi phạm quy chế nghiêm trọng. Đề tài khóa luận này không được phép nộp lại hoặc chấm lại trong học kỳ hiện tại.',
    },
  });

  console.log('🔄 Seeded 2 Resubmission requests (1 CHO_XU_LY, 1 TU_CHOI).');

  // ==========================================
  // 10. COMMENTS & NOTIFICATIONS
  // ==========================================

  await prisma.comment.createMany({
    data: [
      { submissionId: sub1.id, userId: tUserCnpm1.id, content: 'Nhóm phân chia công việc rõ ràng, phần demo hoạt động rất tốt.' },
      { submissionId: sub1.id, userId: students[0].user.id, content: 'Dạ chúng em xin cảm ơn những nhận xét quý giá của thầy ạ!' },
      { submissionId: sub4.id, userId: tUserCnpm2.id, content: 'Sơ đồ tuần tự vẽ sai ký pháp Actor và Boundary. Hãy sửa lại rồi gửi yêu cầu nộp lại cho tôi duyệt.' },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: students[0].user.id, title: 'Báo cáo đã hoàn thành chấm điểm', content: 'Bài nộp của bạn đã được chấm điểm chi tiết và xác nhận từ Phòng Đào Tạo.', type: 'TRANG_THAI', submissionId: sub1.id },
      { userId: students[6].user.id, title: 'Yêu cầu chỉnh sửa báo cáo', content: 'Giảng viên yêu cầu bạn cập nhật tài liệu báo cáo đề tài.', type: 'YEU_CAU_SUA', submissionId: sub4.id },
      { userId: tUserCnpm1.id, title: 'Báo cáo mới được nộp', content: 'Nhóm 2 lớp SE301_L01 đã cập nhật báo cáo.', type: 'DEADLINE', submissionId: sub2.id },
    ],
  });

  console.log('💬 Seeded 3 Comments and 3 Notifications.');

  // ==========================================
  // 11. SYSTEM CONFIGURATIONS & LOGS
  // ==========================================
  await prisma.systemConfig.createMany({
    data: [
      { key: 'MAX_FILE_SIZE_MB', value: '50', description: 'Dung lượng tối đa được phép upload (MB)' },
      { key: 'ALLOWED_FILE_EXTENSIONS', value: 'pdf,docx,zip,rar', description: 'Các định dạng tệp báo cáo được chấp nhận' },
      { key: 'DUPLICATE_THRESHOLD_PERCENT', value: '30', description: 'Ngưỡng trùng lặp tối đa được phép cảnh báo (%)' },
      { key: 'SEMESTER_ACTIVE', value: 'HK2-2025-2026', description: 'Học kỳ mở hoạt động hiện tại của hệ thống' },
    ],
  });

  await prisma.systemLog.createMany({
    data: [
      { userId: adminUser.id, action: 'SEVER_START', description: 'Hệ thống được khởi động và cấu hình tham số.', ipAddress: '127.0.0.1' },
      { userId: deptUser.id, action: 'ACADEMIC_ASSIGN', description: 'Phân công giảng viên PGS.TS Nguyễn Văn A phụ trách lớp SE301_L01.', ipAddress: '192.168.1.15' },
    ],
  });
  console.log('⚙️ Configured 4 default system parameters and logged system actions.');

  console.log('🎉 Database seeding completed successfully with massive and rich mock data!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
