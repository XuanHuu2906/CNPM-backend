/**
 * E2E test: luồng SV nộp bài → GV chấm → GV gửi duyệt → PĐT duyệt/trả về.
 *
 * Yêu cầu backend đang chạy tại http://localhost:5000.
 *
 * Cách dùng:
 *   npx tsx scripts/e2e-submission-lifecycle.ts
 *
 * Script:
 *  1. Tạo fixture cô lập với prefix e2e_<timestamp>_ (Faculty, Subject, Term, Class,
 *     Rubric, Teacher, 2 Student, PĐT, Group, Assignment, Enrollment).
 *  2. Chạy 7 phase: SV nộp → SV nộp đè (negative) → GV chấm (+ negatives) → GV gửi duyệt
 *     → PĐT duyệt 1 bài → PĐT trả về kèm reason → PĐT batch approve.
 *  3. Mỗi phase: gọi HTTP qua axios, verify state qua Prisma.
 *  4. Dọn dẹp toàn bộ entity đã tạo (try/finally).
 *
 * Kết quả in ra: PASS/FAIL từng bước. Exit code 0 nếu mọi assertion qua.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';

// ===== Lightweight fetch-based HTTP client (Node 18+ có sẵn fetch) =====
interface HttpResp<T = any> {
  status: number;
  data: T | undefined;
}
class HttpClient {
  constructor(private base: string, private token?: string) {}
  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }
  async post<T = any>(path: string, body?: any): Promise<HttpResp<T>> {
    const res = await fetch(this.base + path, {
      method: 'POST',
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await safeJson(res) };
  }
  async put<T = any>(path: string, body?: any): Promise<HttpResp<T>> {
    const res = await fetch(this.base + path, {
      method: 'PUT',
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await safeJson(res) };
  }
  async patch<T = any>(path: string, body?: any): Promise<HttpResp<T>> {
    const res = await fetch(this.base + path, {
      method: 'PATCH',
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await safeJson(res) };
  }
  async get<T = any>(path: string): Promise<HttpResp<T>> {
    const res = await fetch(this.base + path, { headers: this.headers() });
    return { status: res.status, data: await safeJson(res) };
  }
}
async function safeJson(res: Response): Promise<any> {
  try { return await res.json(); } catch { return undefined; }
}

const API_BASE = 'http://localhost:5000/api/v1';
const TS = Date.now();
const PREFIX = `e2e${TS}`; // dùng ngắn để pass min-length validators

// ===== Tracking để cleanup =====
const created = {
  userIds: [] as string[],
  studentIds: [] as string[],
  teacherIds: [] as string[],
  academicDeptIds: [] as string[],
  facultyIds: [] as string[],
  subjectIds: [] as string[],
  termIds: [] as string[],
  classIds: [] as string[],
  groupIds: [] as string[],
  rubricIds: [] as string[],
  submissionIds: [] as string[],
};

// ===== Pretty logger =====
let passed = 0;
let failed = 0;
const fails: string[] = [];

function ok(msg: string) {
  passed++;
  console.log(`  ✓ ${msg}`);
}
function bad(msg: string, detail?: any) {
  failed++;
  const line = `  ✗ ${msg}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`;
  fails.push(line);
  console.log(line);
}
function section(name: string) {
  console.log(`\n── ${name} ──`);
}

function asErr(e: any): string {
  return e?.message || String(e);
}

// ===== Setup fixtures =====
async function setupFixtures() {
  section('Setup fixtures');
  const passHash = await bcrypt.hash('Password123@', 10);

  // Faculty
  const faculty = await prisma.faculty.create({
    data: { code: `${PREFIX}_F`, name: `E2E Faculty ${TS}` },
  });
  created.facultyIds.push(faculty.id);

  // Term (active)
  const term = await prisma.academicTerm.create({
    data: {
      name: `E2E Term ${TS}`,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isLocked: false,
    },
  });
  created.termIds.push(term.id);

  // Subject
  const subject = await prisma.subject.create({
    data: { subjectCode: `${PREFIX}_S`, name: `E2E Subject ${TS}`, facultyId: faculty.id },
  });
  created.subjectIds.push(subject.id);

  // Class
  const clazz = await prisma.class.create({
    data: {
      classCode: `${PREFIX}_C`,
      subjectId: subject.id,
      termId: term.id,
      assignmentType: 'NHOM',
    },
  });
  created.classIds.push(clazz.id);

  // Teacher
  const teacherUser = await prisma.user.create({
    data: {
      email: `${PREFIX}_t@e2e.local`,
      password: passHash,
      fullName: 'E2E Teacher',
      role: 'TEACHER',
      isActive: true,
    },
  });
  created.userIds.push(teacherUser.id);
  const teacher = await prisma.teacher.create({
    data: { teacherCode: `${PREFIX}_T`, userId: teacherUser.id, facultyId: faculty.id },
  });
  created.teacherIds.push(teacher.id);

  // Assignment teacher ↔ class
  await prisma.assignment.create({
    data: { classId: clazz.id, teacherId: teacher.id },
  });

  // Rubric + criteria
  const rubric = await prisma.rubric.create({
    data: { title: `E2E Rubric ${TS}`, teacherId: teacher.id },
  });
  created.rubricIds.push(rubric.id);
  const criteria1 = await prisma.criteria.create({
    data: { rubricId: rubric.id, name: 'TC1', maxScore: 10, weight: 60 },
  });
  const criteria2 = await prisma.criteria.create({
    data: { rubricId: rubric.id, name: 'TC2', maxScore: 10, weight: 40 },
  });

  // 2 students
  const sv1User = await prisma.user.create({
    data: { email: `${PREFIX}_s1@e2e.local`, password: passHash, fullName: 'E2E SV 1', role: 'STUDENT', isActive: true },
  });
  created.userIds.push(sv1User.id);
  const sv1 = await prisma.student.create({
    data: { studentCode: `${PREFIX}_S1`, userId: sv1User.id, facultyId: faculty.id },
  });
  created.studentIds.push(sv1.id);

  const sv2User = await prisma.user.create({
    data: { email: `${PREFIX}_s2@e2e.local`, password: passHash, fullName: 'E2E SV 2', role: 'STUDENT', isActive: true },
  });
  created.userIds.push(sv2User.id);
  const sv2 = await prisma.student.create({
    data: { studentCode: `${PREFIX}_S2`, userId: sv2User.id, facultyId: faculty.id },
  });
  created.studentIds.push(sv2.id);

  // Enroll both into class
  await prisma.classEnrollment.create({ data: { studentId: sv1.id, classId: clazz.id } });
  await prisma.classEnrollment.create({ data: { studentId: sv2.id, classId: clazz.id } });

  // Group with topicName + 2 members
  const group = await prisma.group.create({
    data: { name: 'NhomE2E', topicName: 'Đề tài E2E', classId: clazz.id },
  });
  created.groupIds.push(group.id);
  await prisma.groupMember.create({ data: { groupId: group.id, studentId: sv1.id } });
  await prisma.groupMember.create({ data: { groupId: group.id, studentId: sv2.id } });

  // group2 (batch test) + group3 (reopen) + group4 (resubmission). Mỗi group 1 SV riêng để
  // tránh đụng ràng buộc "1 SV / 1 group / 1 class".
  async function makeGroupWithStudent(idx: number) {
    const u = await prisma.user.create({
      data: { email: `${PREFIX}_s${idx}@e2e.local`, password: passHash, fullName: `E2E SV ${idx}`, role: 'STUDENT', isActive: true },
    });
    created.userIds.push(u.id);
    const s = await prisma.student.create({
      data: { studentCode: `${PREFIX}_S${idx}`, userId: u.id, facultyId: faculty.id },
    });
    created.studentIds.push(s.id);
    await prisma.classEnrollment.create({ data: { studentId: s.id, classId: clazz.id } });
    const g = await prisma.group.create({
      data: { name: `NhomE2E${idx}`, topicName: `Đề tài E2E ${idx}`, classId: clazz.id },
    });
    created.groupIds.push(g.id);
    await prisma.groupMember.create({ data: { groupId: g.id, studentId: s.id } });
    return { user: u, student: s, group: g };
  }
  const g2 = await makeGroupWithStudent(3);
  const group2 = g2.group;
  const sv3User = g2.user;
  const g3 = await makeGroupWithStudent(4);
  const g4 = await makeGroupWithStudent(5);

  // PĐT
  const pdtUser = await prisma.user.create({
    data: { email: `${PREFIX}_p@e2e.local`, password: passHash, fullName: 'E2E PĐT', role: 'ACADEMIC_DEPT', isActive: true },
  });
  created.userIds.push(pdtUser.id);
  const pdt = await prisma.academicDept.create({
    data: { employeeCode: `${PREFIX}_P`, userId: pdtUser.id },
  });
  created.academicDeptIds.push(pdt.id);

  // Teacher khác (không assign vào class) — dùng test 403 ownership
  const tOtherUser = await prisma.user.create({
    data: { email: `${PREFIX}_tx@e2e.local`, password: passHash, fullName: 'E2E Teacher OTHER', role: 'TEACHER', isActive: true },
  });
  created.userIds.push(tOtherUser.id);
  const tOther = await prisma.teacher.create({
    data: { teacherCode: `${PREFIX}_TX`, userId: tOtherUser.id, facultyId: faculty.id },
  });
  created.teacherIds.push(tOther.id);

  console.log(`  Fixtures ready: class=${clazz.id} group1=${group.id} group2=${group2.id}`);
  return {
    faculty,
    term,
    subject,
    clazz,
    teacher,
    teacherUser,
    teacherEmail: teacherUser.email,
    tOtherEmail: tOtherUser.email,
    rubric,
    criteria: [criteria1, criteria2],
    sv1,
    sv1Id: sv1.id,
    sv1Email: sv1User.email,
    sv2,
    sv2Id: sv2.id,
    sv2Email: sv2User.email,
    sv3Email: sv3User.email,
    group,
    group2,
    sv4Email: g3.user.email,
    sv4Id: g3.student.id,
    sv5Email: g4.user.email,
    sv5Id: g4.student.id,
    pdtEmail: pdtUser.email,
  };
}

// ===== Cleanup =====
async function cleanup() {
  section('Cleanup');
  try {
    // Xóa toàn bộ submission thuộc class fixture (kể cả những bài tạo runtime không kịp track vào created.submissionIds)
    if (created.classIds.length) {
      const subs = await prisma.submission.findMany({
        where: {
          OR: [
            { group: { classId: { in: created.classIds } } },
            { student: { enrollments: { some: { classId: { in: created.classIds } } } } },
          ],
        },
        select: { id: true },
      });
      const subIds = subs.map((s) => s.id);
      if (subIds.length) {
        // Dọn các bảng phụ thuộc Grade trước
        const gradeIds = (await prisma.grade.findMany({ where: { submissionId: { in: subIds } }, select: { id: true } })).map(g => g.id);
        if (gradeIds.length) {
          await prisma.gradeMemberAdjustment.deleteMany({ where: { gradeId: { in: gradeIds } } });
        }
        await prisma.gradingReopenRequest.deleteMany({ where: { submissionId: { in: subIds } } });
        await prisma.resubmissionRequest.deleteMany({ where: { submissionId: { in: subIds } } });
        await prisma.grade.deleteMany({ where: { submissionId: { in: subIds } } });
        await prisma.submissionLog.deleteMany({ where: { submissionId: { in: subIds } } });
        await prisma.notification.deleteMany({ where: { submissionId: { in: subIds } } });
        await prisma.submission.deleteMany({ where: { id: { in: subIds } } });
      }
    }
    await prisma.groupMember.deleteMany({ where: { groupId: { in: created.groupIds } } });
    await prisma.group.deleteMany({ where: { id: { in: created.groupIds } } });
    await prisma.classEnrollment.deleteMany({ where: { classId: { in: created.classIds } } });
    await prisma.assignment.deleteMany({ where: { classId: { in: created.classIds } } });
    await prisma.criteria.deleteMany({ where: { rubricId: { in: created.rubricIds } } });
    await prisma.rubric.deleteMany({ where: { id: { in: created.rubricIds } } });
    await prisma.class.deleteMany({ where: { id: { in: created.classIds } } });
    await prisma.subject.deleteMany({ where: { id: { in: created.subjectIds } } });
    await prisma.academicTerm.deleteMany({ where: { id: { in: created.termIds } } });
    await prisma.systemLog.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.academicDept.deleteMany({ where: { id: { in: created.academicDeptIds } } });
    await prisma.teacher.deleteMany({ where: { id: { in: created.teacherIds } } });
    await prisma.student.deleteMany({ where: { id: { in: created.studentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.faculty.deleteMany({ where: { id: { in: created.facultyIds } } });
    console.log('  Cleanup OK');
  } catch (e: any) {
    console.error(`  Cleanup warning: ${e.message}`);
  }
}

// ===== Login helper =====
async function login(email: string, password = 'Password123@'): Promise<HttpClient> {
  const anon = new HttpClient(API_BASE);
  const r = await anon.post('/auth/login', { email, password });
  if (r.status !== 200 || !r.data?.data?.token) {
    throw new Error(`Login fail cho ${email}: HTTP ${r.status} ${JSON.stringify(r.data)}`);
  }
  return new HttpClient(API_BASE, r.data.data.token);
}

// ===== Main =====
async function main() {
  const f = await setupFixtures();

  const sv1 = await login(f.sv1Email);
  const teacher = await login(f.teacherEmail);
  const tOther = await login(f.tOtherEmail);
  const pdt = await login(f.pdtEmail);

  // ============================================================
  // PHASE 2: SV nộp bài lần đầu
  // ============================================================
  section('PHASE 2 — SV nộp bài lần đầu');

  // Happy path: nộp mới
  let r = await sv1.post('/submissions/submit', {
    filePath: 'https://example.com/e2e.pdf',
    classId: f.clazz.id,
  });
  if ((r.status === 200 || r.status === 201) && r.data?.data?.status === 'DA_NOP') {
    created.submissionIds.push(r.data.data.id);
    ok(`SV1 nộp mới → DA_NOP (id=${r.data.data.id.slice(0, 8)}…)`);
  } else {
    bad('SV1 nộp mới expected 2xx/DA_NOP', { status: r.status, data: r.data });
  }
  const submissionId = r.data?.data?.id;

  // Negative: SV không enroll lớp này
  // Tạo class khác trong cùng term để SV2 ko enroll
  const otherClass = await prisma.class.create({
    data: { classCode: `${PREFIX}_C2`, subjectId: f.subject.id, termId: f.term.id, assignmentType: 'NHOM' },
  });
  created.classIds.push(otherClass.id);
  r = await sv1.post('/submissions/submit', {
    filePath: 'https://example.com/x.pdf',
    classId: otherClass.id,
  });
  if (r.status === 400) ok('SV1 nộp class chưa enroll → 400');
  else bad('SV1 nộp class chưa enroll expected 400', { status: r.status, data: r.data });

  // Negative: nộp đè khi không có YEU_CAU_SUA và không có ResubmissionRequest
  r = await sv1.post('/submissions/submit', {
    filePath: 'https://example.com/e2e_v2.pdf',
    classId: f.clazz.id,
  });
  if (r.status === 400 && /Yêu cầu nộp lại/i.test(r.data?.message || '')) {
    ok('SV1 nộp đè khi chưa được phép → 400 message đúng');
  } else {
    bad('SV1 nộp đè expected 400 với message Yêu cầu nộp lại', { status: r.status, data: r.data });
  }

  // ============================================================
  // PHASE 4: GV chấm
  // ============================================================
  section('PHASE 4 — GV chấm điểm');

  // Negative: GV khác lớp chấm → 403
  r = await tOther.post(`/grades/submission/${submissionId}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 8 },
      { criteriaId: f.criteria[1].id, score: 9 },
    ],
    version: 1,
  });
  if (r.status === 403) ok('GV khác lớp chấm → 403');
  else bad('GV khác lớp expected 403', { status: r.status, data: r.data });

  // Negative: rubric thiếu criteria (chỉ gửi 1)
  r = await teacher.post(`/grades/submission/${submissionId}`, {
    rubricId: f.rubric.id,
    detailedScores: [{ criteriaId: f.criteria[0].id, score: 8 }],
    version: 1,
  });
  if (r.status === 400 && /trùng khớp/i.test(r.data?.message || '')) {
    ok('Thiếu criteria → 400 message đúng');
  } else bad('Thiếu criteria expected 400', { status: r.status, data: r.data });

  // Negative: điểm vượt max
  r = await teacher.post(`/grades/submission/${submissionId}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 99 },
      { criteriaId: f.criteria[1].id, score: 5 },
    ],
    version: 1,
  });
  if (r.status === 400) ok('Điểm vượt max → 400');
  else bad('Điểm vượt max expected 400', { status: r.status, data: r.data });

  // Happy: GV chấm hợp lệ (isDraft mặc định false → status sang DA_CHAM)
  r = await teacher.post(`/grades/submission/${submissionId}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 8 },
      { criteriaId: f.criteria[1].id, score: 9 },
    ],
    feedback: 'Test E2E feedback',
    version: 1,
  });
  if (r.status === 200 || r.status === 201) ok(`GV chấm hợp lệ → grade.finalScore=${r.data?.data?.finalScore}`);
  else bad('GV chấm hợp lệ expected 2xx', { status: r.status, data: r.data });

  // Verify submission.status = CHO_DUYET
  let sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (sub?.status === 'CHO_DUYET') ok('DB: submission.status = CHO_DUYET sau khi GV chấm');
  else bad(`DB: submission.status expected CHO_DUYET, got ${sub?.status}`);

  // Negative: GV chấm lại khi đã CHO_DUYET → 403
  r = await teacher.post(`/grades/submission/${submissionId}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 7 },
      { criteriaId: f.criteria[1].id, score: 8 },
    ],
    version: 2,
  });
  if (r.status === 403 && /mở lại chấm điểm/i.test(r.data?.message || '')) {
    ok('GV chấm lại khi CHO_DUYET → 403 (yêu cầu reopen)');
  } else bad('GV chấm lại expected 403', { status: r.status, data: r.data });

  // ============================================================
  // PHASE 5: GV gửi duyệt lớp (DA_CHAM → CHO_DUYET)
  // ============================================================
  section('PHASE 5 — GV gửi duyệt lớp');

  r = await teacher.post(`/teacher/class-sections/${f.clazz.id}/submit-for-review`);
  if (r.status === 200) {
    ok(`GV gửi duyệt lớp → moved=${r.data?.data?.movedCount} skipped=${r.data?.data?.skippedCount}`);
  } else bad('GV gửi duyệt expected 200', { status: r.status, data: r.data });

  sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (sub?.status === 'CHO_DUYET') ok('DB: submission.status = CHO_DUYET sau khi gửi duyệt');
  else bad(`DB: submission.status expected CHO_DUYET, got ${sub?.status}`);

  // ============================================================
  // PHASE 6: PĐT duyệt 1 bài (CHO_DUYET → HOAN_THANH)
  // ============================================================
  section('PHASE 6 — PĐT duyệt 1 bài');

  let grade = await prisma.grade.findUnique({ where: { submissionId } });
  if (!grade) {
    bad('Grade not found cho submission — skip phase 6');
  } else {
    // Negative: version sai
    r = await pdt.put(`/system/grades/${submissionId}/approve`, {
      isApproved: true,
      version: 9999,
    });
    if (r.status === 400 && /thay đổi/i.test(r.data?.message || '')) {
      ok('PĐT duyệt version sai → 400 OCC');
    } else bad('PĐT version sai expected 400 OCC', { status: r.status, data: r.data });

    // Happy: duyệt
    r = await pdt.put(`/system/grades/${submissionId}/approve`, {
      isApproved: true,
      version: grade.version,
    });
    if (r.status === 200) ok(`PĐT duyệt 1 bài → 200`);
    else bad('PĐT duyệt expected 200 (đây là chỗ trước fix bị 500 FK)', { status: r.status, data: r.data });

    // Verify
    sub = await prisma.submission.findUnique({ where: { id: submissionId } });
    grade = await prisma.grade.findUnique({ where: { submissionId } });
    if (sub?.status === 'HOAN_THANH') ok('DB: submission.status = HOAN_THANH (fix status sync)');
    else bad(`DB: status expected HOAN_THANH, got ${sub?.status}`);
    if (grade?.isApproved === true) ok('DB: grade.isApproved = true');
    else bad('DB: grade.isApproved expected true');
    const sysLogs = await prisma.systemLog.findMany({
      where: { description: { contains: submissionId } },
    });
    if (sysLogs.length >= 1) ok(`DB: SystemLog ghi với User.id (fix FK 500), found ${sysLogs.length} entry`);
    else bad('DB: SystemLog chưa ghi');
    const subLogs = await prisma.submissionLog.findMany({
      where: { submissionId, newStatus: 'HOAN_THANH' },
    });
    if (subLogs.length >= 1) ok('DB: SubmissionLog ghi transition → HOAN_THANH');
    else bad('DB: SubmissionLog chưa ghi transition HOAN_THANH');
  }

  // ============================================================
  // PHASE 7: PĐT trả về kèm reason (HOAN_THANH → DANG_CHAM)
  // ============================================================
  section('PHASE 7 — PĐT trả về chấm lại');

  grade = await prisma.grade.findUnique({ where: { submissionId } });
  if (!grade) {
    bad('Grade not found — skip phase 7');
  } else {
    // Negative: reason rỗng
    r = await pdt.put(`/system/grades/${submissionId}/approve`, {
      isApproved: false,
      version: grade.version,
    });
    if (r.status === 400) ok('PĐT trả về thiếu reason → 400');
    else bad('PĐT thiếu reason expected 400', { status: r.status, data: r.data });

    // Negative: reason quá ngắn
    r = await pdt.put(`/system/grades/${submissionId}/approve`, {
      isApproved: false,
      version: grade.version,
      reason: 'x',
    });
    if (r.status === 400) ok('PĐT trả về reason < 5 ký tự → 400');
    else bad('PĐT reason ngắn expected 400', { status: r.status, data: r.data });

    // Happy: trả về với reason hợp lệ
    r = await pdt.put(`/system/grades/${submissionId}/approve`, {
      isApproved: false,
      version: grade.version,
      reason: 'Chấm sai tiêu chí TC1, cần rà soát',
    });
    if (r.status === 200) ok('PĐT trả về kèm reason → 200');
    else bad('PĐT trả về expected 200', { status: r.status, data: r.data });

    // Verify
    sub = await prisma.submission.findUnique({ where: { id: submissionId } });
    grade = await prisma.grade.findUnique({ where: { submissionId } });
    if (sub?.status === 'DANG_CHAM') ok('DB: submission.status = DANG_CHAM');
    else bad(`DB: status expected DANG_CHAM, got ${sub?.status}`);
    if (sub?.rejectReason && /Chấm sai/.test(sub.rejectReason)) ok('DB: submission.rejectReason đã lưu');
    else bad(`DB: rejectReason expected lưu, got "${sub?.rejectReason}"`);
    if (grade?.isApproved === false) ok('DB: grade.isApproved = false (gỡ duyệt)');
    else bad('DB: grade.isApproved expected false');
    const subLogs = await prisma.submissionLog.findMany({
      where: { submissionId, newStatus: 'DANG_CHAM' },
    });
    if (subLogs.length >= 1) ok('DB: SubmissionLog ghi transition → DANG_CHAM');
    else bad('DB: SubmissionLog chưa ghi transition DANG_CHAM');
  }

  // ============================================================
  // PHASE 8: Batch approve (group2 — SV3 nộp + GV chấm + gửi duyệt + batch)
  // ============================================================
  section('PHASE 8 — Batch approve');

  const sv3 = await login(f.sv3Email);
  r = await sv3.post('/submissions/submit', {
    filePath: 'https://example.com/e2e_group2.pdf',
    classId: f.clazz.id,
  });
  const sub2Id = r.data?.data?.id;
  if (sub2Id) {
    created.submissionIds.push(sub2Id);
    ok(`SV3 (group2) nộp → DA_NOP id=${sub2Id.slice(0, 8)}`);
  } else {
    bad('SV3 nộp fail', r.data);
  }

  // GV chấm
  if (sub2Id) {
    r = await teacher.post(`/grades/submission/${sub2Id}`, {
      rubricId: f.rubric.id,
      detailedScores: [
        { criteriaId: f.criteria[0].id, score: 9 },
        { criteriaId: f.criteria[1].id, score: 9 },
      ],
      version: 1,
    });
    if (r.status === 200 || r.status === 201) ok(`GV chấm group2 → 2xx, finalScore=${r.data?.data?.finalScore}`);
    else bad('GV chấm group2 expected 2xx', { status: r.status, data: r.data });

    // GV gửi duyệt (đã tự động gửi khi chấm, nên movedCount = 0)
    r = await teacher.post(`/teacher/class-sections/${f.clazz.id}/submit-for-review`);
    if (r.status === 200 && r.data?.data?.movedCount === 0) ok(`Gửi duyệt lớp lần 2 → moved=${r.data.data.movedCount} (đã tự động gửi)`);
    else bad('Gửi duyệt expected moved=0', r.data);

    // PĐT batch approve
    r = await pdt.post('/system/grades/batch-approve', {
      submissionIds: [sub2Id],
      action: 'APPROVE',
    });
    if (r.status === 200 && r.data?.data?.successCount === 1) {
      ok('PĐT batch APPROVE → successCount=1');
    } else bad('Batch APPROVE expected success=1', { status: r.status, data: r.data });

    const sub2 = await prisma.submission.findUnique({ where: { id: sub2Id } });
    if (sub2?.status === 'HOAN_THANH') ok('DB: group2 submission → HOAN_THANH');
    else bad(`DB: group2 status expected HOAN_THANH, got ${sub2?.status}`);

    // Negative: batch RETURN không có reason
    r = await pdt.post('/system/grades/batch-approve', {
      submissionIds: [sub2Id],
      action: 'RETURN',
    });
    if (r.status === 400) ok('Batch RETURN không reason → 400');
    else bad('Batch RETURN thiếu reason expected 400', { status: r.status, data: r.data });

    // Negative: batch > 100 IDs
    r = await pdt.post('/system/grades/batch-approve', {
      submissionIds: Array(101).fill('x').map((_, i) => `bogus_${i}`),
      action: 'APPROVE',
    });
    if (r.status === 400) ok('Batch > 100 IDs → 400');
    else bad('Batch > 100 expected 400', { status: r.status, data: r.data });
  }

  // ============================================================
  // PHASE 9 — Member adjustment (hệ số 0–1.5) trên bài nhóm
  // ============================================================
  section('PHASE 9 — Member adjustment');

  // group1 hiện đang DANG_CHAM (sau Phase 7), grade tồn tại → đủ điều kiện điều chỉnh.
  // Negative: hệ số > 1.5
  r = await teacher.put(`/grades/submission/${submissionId}/member-adjustments`, {
    adjustments: [
      { studentId: f.sv1Id, contributionFactor: 1.8 },
      { studentId: f.sv2Id, contributionFactor: 1.0 },
    ],
  });
  if (r.status === 400) ok('Hệ số > 1.5 → 400 (Zod)');
  else bad('Hệ số > 1.5 expected 400', { status: r.status, data: r.data });

  // Negative: hệ số âm
  r = await teacher.put(`/grades/submission/${submissionId}/member-adjustments`, {
    adjustments: [
      { studentId: f.sv1Id, contributionFactor: -0.1 },
      { studentId: f.sv2Id, contributionFactor: 1.0 },
    ],
  });
  if (r.status === 400) ok('Hệ số < 0 → 400');
  else bad('Hệ số < 0 expected 400', { status: r.status, data: r.data });

  // Negative: studentId không thuộc nhóm
  r = await teacher.put(`/grades/submission/${submissionId}/member-adjustments`, {
    adjustments: [{ studentId: f.sv4Id, contributionFactor: 1.0 }],
  });
  if (r.status === 400 && /không thuộc nhóm/i.test(r.data?.message || '')) {
    ok('SV ngoài nhóm → 400 message đúng');
  } else bad('SV ngoài nhóm expected 400', { status: r.status, data: r.data });

  // Happy: set hệ số hợp lệ
  r = await teacher.put(`/grades/submission/${submissionId}/member-adjustments`, {
    adjustments: [
      { studentId: f.sv1Id, contributionFactor: 1.5, note: 'Tích cực' },
      { studentId: f.sv2Id, contributionFactor: 0.8, note: 'Đóng góp ít' },
    ],
  });
  if (r.status === 200 || r.status === 201) ok('Set hệ số hợp lệ → 2xx');
  else bad('Set hệ số expected 2xx', { status: r.status, data: r.data });

  // Verify GET /with-adjustments → personalScore khác nhau
  r = await teacher.get(`/grades/submission/${submissionId}/with-adjustments`);
  if (r.status === 200 && Array.isArray(r.data?.data?.members)) {
    const groupScore = Number(r.data.data.groupScore);
    const sv1Row = r.data.data.members.find((m: any) => m.studentId === f.sv1Id);
    const sv2Row = r.data.data.members.find((m: any) => m.studentId === f.sv2Id);
    const sv1Personal = Number(sv1Row?.personalScore);
    const sv2Personal = Number(sv2Row?.personalScore);
    // SV1 hệ số 1.5, SV2 hệ số 0.8 → personalScore SV1 > SV2 (cap tại 10)
    if (sv1Personal > sv2Personal) {
      ok(`Personal score lệch đúng hướng (SV1=${sv1Personal} > SV2=${sv2Personal}, group=${groupScore})`);
    } else {
      bad(`Personal score: SV1=${sv1Personal} expected > SV2=${sv2Personal}`);
    }
  } else bad('GET with-adjustments expected 200 với members[]', { status: r.status, data: r.data });

  // ============================================================
  // PHASE 10 — Reopen Request (GV xin mở lại chấm sau DA_CHAM)
  // ============================================================
  section('PHASE 10 — Reopen Request');

  // Setup: SV4 (group3) nộp → GV chấm → status DA_CHAM
  const sv4 = await login(f.sv4Email);
  r = await sv4.post('/submissions/submit', {
    filePath: 'https://example.com/e2e_reopen.pdf',
    classId: f.clazz.id,
  });
  const sub3Id = r.data?.data?.id;
  if (sub3Id) {
    created.submissionIds.push(sub3Id);
    ok(`SV4 nộp → DA_NOP id=${sub3Id.slice(0, 8)}`);
  } else bad('SV4 nộp fail', r.data);

  if (sub3Id) {
    r = await teacher.post(`/grades/submission/${sub3Id}`, {
      rubricId: f.rubric.id,
      detailedScores: [
        { criteriaId: f.criteria[0].id, score: 7 },
        { criteriaId: f.criteria[1].id, score: 7 },
      ],
      version: 1,
    });
    if (r.status === 200 || r.status === 201) ok('GV chấm sub3 → CHO_DUYET');
    else bad('GV chấm sub3 expected 2xx', { status: r.status, data: r.data });

    // Negative: reason < 10 ký tự
    r = await teacher.post(`/teacher/submissions/${sub3Id}/reopen-request`, {
      reason: 'ngan',
    });
    if (r.status === 400) ok('Reopen reason < 10 ký tự → 400');
    else bad('Reopen reason ngắn expected 400', { status: r.status, data: r.data });

    // Negative: GV khác lớp không được gửi reopen
    r = await tOther.post(`/teacher/submissions/${sub3Id}/reopen-request`, {
      reason: 'Yêu cầu mở lại do điểm chưa chính xác',
    });
    if (r.status === 403) ok('GV khác lớp gửi reopen → 403');
    else bad('GV khác lớp reopen expected 403', { status: r.status, data: r.data });

    // Happy: GV gửi reopen
    r = await teacher.post(`/teacher/submissions/${sub3Id}/reopen-request`, {
      reason: 'Phát hiện chấm sai tiêu chí TC2, cần rà soát lại',
    });
    let reopenReqId: string | undefined;
    if (r.status === 200 || r.status === 201) {
      reopenReqId = r.data?.data?.requestId;
      ok(`Reopen request tạo OK, id=${reopenReqId?.slice(0, 8)}`);
    } else bad('Reopen request expected 2xx', { status: r.status, data: r.data });

    // Negative: gửi reopen lần 2 khi pending → 400
    r = await teacher.post(`/teacher/submissions/${sub3Id}/reopen-request`, {
      reason: 'Yêu cầu thứ hai trong khi đang pending',
    });
    if (r.status === 400 && /chờ duyệt/i.test(r.data?.message || '')) {
      ok('Reopen lần 2 khi pending → 400');
    } else bad('Reopen lần 2 expected 400', { status: r.status, data: r.data });

    // PĐT view & approve
    if (reopenReqId) {
      r = await pdt.get('/academic/grading-reopen-requests');
      const list = r.data?.data;
      if (r.status === 200 && Array.isArray(list) && list.some((x: any) => x.id === reopenReqId)) {
        ok('PĐT thấy reopen request trong danh sách');
      } else bad('PĐT GET reopen list expected request mới', { status: r.status, count: Array.isArray(list) ? list.length : 0 });

      // PĐT approve (PATCH endpoint)
      r = await pdt.patch(`/academic/grading-reopen-requests/${reopenReqId}/approve`, {
        reviewNote: 'Đồng ý mở lại',
      });
      if (r.status === 200) ok('PĐT duyệt reopen → 200');
      else bad('PĐT duyệt reopen expected 200', { status: r.status, data: r.data });

      // Verify submission về DANG_CHAM
      const subAfter = await prisma.submission.findUnique({ where: { id: sub3Id } });
      if (subAfter?.status === 'DANG_CHAM') ok('DB: submission về DANG_CHAM sau PĐT duyệt reopen');
      else bad(`DB: status expected DANG_CHAM, got ${subAfter?.status}`);

      // GV chấm lại → DA_CHAM (verify lock đã mở)
      const gradeBefore = await prisma.grade.findUnique({ where: { submissionId: sub3Id } });
      r = await teacher.post(`/grades/submission/${sub3Id}`, {
        rubricId: f.rubric.id,
        detailedScores: [
          { criteriaId: f.criteria[0].id, score: 8 },
          { criteriaId: f.criteria[1].id, score: 9 },
        ],
        version: gradeBefore?.version ?? 1,
      });
      if (r.status === 200 || r.status === 201) ok('GV chấm lại sau reopen → 2xx');
      else bad('GV chấm lại expected 2xx', { status: r.status, data: r.data });
    }
  }

  // ============================================================
  // PHASE 11 — Resubmission Request (SV xin nộp đè sau khi đã grade)
  // ============================================================
  section('PHASE 11 — Resubmission Request');

  // Setup: SV5 (group4) nộp → GV chấm → DA_CHAM
  const sv5 = await login(f.sv5Email);
  r = await sv5.post('/submissions/submit', {
    filePath: 'https://example.com/e2e_resub.pdf',
    classId: f.clazz.id,
  });
  const sub4Id = r.data?.data?.id;
  if (sub4Id) {
    created.submissionIds.push(sub4Id);
    ok(`SV5 nộp → DA_NOP id=${sub4Id.slice(0, 8)}`);
  } else bad('SV5 nộp fail', r.data);

  if (sub4Id) {
    // Lưu ý: ResubmissionRequest chỉ chấp nhận khi submission ở DA_NOP (rule trong service).
    // → Không chấm trước khi gửi request. Test flow đúng: SV nộp → gửi resub → GV duyệt → SV nộp đè.

    // Negative: SV gửi resub thiếu reason
    r = await sv5.post('/resubmission-requests', {
      submissionId: sub4Id,
    });
    if (r.status === 400) ok('Resub thiếu reason → 400');
    else bad('Resub thiếu reason expected 400', { status: r.status, data: r.data });

    // Negative: SV thử nộp đè trước khi gửi request → 400
    r = await sv5.post('/submissions/submit', {
      filePath: 'https://example.com/e2e_resub_v2.pdf',
      classId: f.clazz.id,
    });
    if (r.status === 400 && /Yêu cầu nộp lại/i.test(r.data?.message || '')) {
      ok('SV nộp đè trước khi xin → 400 message đúng');
    } else bad('SV nộp đè trước khi xin expected 400', { status: r.status, data: r.data });

    // Happy: SV gửi resub request
    r = await sv5.post('/resubmission-requests', {
      submissionId: sub4Id,
      reason: 'Em phát hiện sai sót ở phần thiết kế, xin nộp lại bản hoàn chỉnh',
    });
    let resubReqId: string | undefined;
    if (r.status === 200 || r.status === 201) {
      resubReqId = r.data?.data?.id;
      ok(`Resub request tạo OK, id=${resubReqId?.slice(0, 8)}`);
    } else bad('Resub request expected 2xx', { status: r.status, data: r.data });

    // GV view pending
    r = await teacher.get('/resubmission-requests/teacher');
    if (r.status === 200 && Array.isArray(r.data?.data) && r.data.data.some((x: any) => x.id === resubReqId)) {
      ok('GV thấy resub request trong pending list');
    } else bad('GV GET teacher resub list expected request', { status: r.status });

    // Negative: GV từ chối thiếu feedbackNote
    if (resubReqId) {
      r = await teacher.put(`/resubmission-requests/${resubReqId}/status`, {
        status: 'TU_CHOI',
      });
      if (r.status === 400) ok('GV từ chối thiếu feedbackNote → 400');
      else bad('GV từ chối thiếu feedbackNote expected 400', { status: r.status, data: r.data });

      // Happy: GV duyệt
      r = await teacher.put(`/resubmission-requests/${resubReqId}/status`, {
        status: 'DA_DUYET',
        feedbackNote: 'OK cho nộp lại',
      });
      if (r.status === 200) ok('GV duyệt resub request → 200');
      else bad('GV duyệt resub expected 200', { status: r.status, data: r.data });

      // SV nộp đè — phải pass (vì có DA_DUYET request)
      r = await sv5.post('/submissions/submit', {
        filePath: 'https://example.com/e2e_resub_v2.pdf',
        classId: f.clazz.id,
      });
      if ((r.status === 200 || r.status === 201) && r.data?.data?.version === 2) {
        ok(`SV nộp đè sau khi được duyệt → version=2`);
      } else bad('SV nộp đè sau duyệt expected version=2', { status: r.status, data: r.data });

      // Verify DB: submission version=2, status=DA_NOP, filePath đã đổi
      const subAfter = await prisma.submission.findUnique({ where: { id: sub4Id } });
      if (subAfter?.version === 2 && subAfter?.status === 'DA_NOP' && /resub_v2/.test(subAfter.filePath)) {
        ok('DB: sub4 version=2, status=DA_NOP, filePath đã cập nhật');
      } else {
        bad(`DB: sub4 expected v2/DA_NOP/v2-file, got v${subAfter?.version}/${subAfter?.status}/${subAfter?.filePath}`);
      }
    }
  }

  // ============================================================
  // PHASE 12 — Kiểm tra chain bug user báo:
  //   GV lưu nháp → GV yêu cầu sửa → SV nộp lại → GV còn save/submit được không?
  //   Đồng thời verify: bản nháp có lộ ra PĐT như CHO_DUYET không?
  // ============================================================
  section('PHASE 12 — Draft → Edit → Resubmit chain');

  // Tạo group6 / SV6 mới để cô lập với các phase trước
  const sv6Data = await prisma.user.create({
    data: { email: `${PREFIX}_s6@e2e.local`, password: await bcrypt.hash('Password123@', 10), fullName: 'E2E SV 6', role: 'STUDENT', isActive: true },
  });
  created.userIds.push(sv6Data.id);
  const sv6Student = await prisma.student.create({
    data: { studentCode: `${PREFIX}_S6`, userId: sv6Data.id, facultyId: f.faculty.id },
  });
  created.studentIds.push(sv6Student.id);
  await prisma.classEnrollment.create({ data: { studentId: sv6Student.id, classId: f.clazz.id } });
  const group6 = await prisma.group.create({
    data: { name: 'NhomE2E_chain', topicName: 'Đề tài chain test', classId: f.clazz.id },
  });
  created.groupIds.push(group6.id);
  await prisma.groupMember.create({ data: { groupId: group6.id, studentId: sv6Student.id } });
  const sv6 = await login(sv6Data.email);

  // Step 1: SV6 nộp lần đầu
  r = await sv6.post('/submissions/submit', {
    filePath: 'https://example.com/chain_v1.pdf',
    classId: f.clazz.id,
  });
  const sub5Id = r.data?.data?.id;
  if (sub5Id) {
    created.submissionIds.push(sub5Id);
    ok(`Step 1: SV6 nộp v1 → DA_NOP id=${sub5Id.slice(0, 8)}`);
  } else { bad('SV6 nộp fail', r.data); return; }

  // Step 2: GV "Lưu bản nháp" (isDraft=true)
  r = await teacher.post(`/grades/submission/${sub5Id}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 6 },
      { criteriaId: f.criteria[1].id, score: 7 },
    ],
    feedback: 'Bản nháp đầu tiên',
    version: 1,
    isDraft: true,
  });
  if (r.status === 200 || r.status === 201) ok('Step 2: GV lưu nháp → 2xx');
  else bad('GV lưu nháp expected 2xx', { status: r.status, data: r.data });

  // Verify: submission.status PHẢI giữ DA_NOP (không được chuyển CHO_DUYET / DA_CHAM)
  let s = await prisma.submission.findUnique({ where: { id: sub5Id } });
  if (s?.status === 'DA_NOP') ok('BE đúng: lưu nháp KHÔNG đổi submission.status (vẫn DA_NOP)');
  else bad(`BE sai: lưu nháp đã đổi status thành ${s?.status} (kỳ vọng DA_NOP)`);

  // CLAIM #1 + #2 của user: PĐT có thấy bản nháp như "đã nộp" và phê duyệt được không?
  // — Test backend: PĐT gọi /system/grades/:id/approve khi status=DA_NOP, grade tồn tại
  let g = await prisma.grade.findUnique({ where: { submissionId: sub5Id } });
  r = await pdt.put(`/system/grades/${sub5Id}/approve`, {
    isApproved: true,
    version: g!.version,
  });
  if (r.status === 400 && /Chờ duyệt/i.test(r.data?.message || '')) {
    ok('BE chặn PĐT duyệt bản nháp (status=DA_NOP) → 400 message đúng');
  } else if (r.status === 200) {
    bad('REGRESSION: PĐT phê duyệt được bản NHÁP — fix BE không hoạt động');
    // Rollback
    await prisma.grade.update({ where: { submissionId: sub5Id }, data: { isApproved: false, approvedById: null } });
    await prisma.submission.update({ where: { id: sub5Id }, data: { status: 'DA_NOP' } });
  } else {
    bad(`PĐT duyệt bản nháp → unexpected ${r.status}`, r.data);
  }

  // Step 3: GV "Yêu cầu sửa" → status YEU_CAU_SUA
  s = await prisma.submission.findUnique({ where: { id: sub5Id } });
  r = await teacher.put(`/submissions/${sub5Id}/status`, {
    status: 'YEU_CAU_SUA',
    editRequestNote: 'Vui lòng làm rõ phần thiết kế',
    version: s!.version,
  });
  if (r.status === 200) ok('Step 3: GV yêu cầu sửa → YEU_CAU_SUA');
  else bad('GV yêu cầu sửa expected 200', { status: r.status, data: r.data });

  // Step 3.5: GV thử chấm khi đang YEU_CAU_SUA → PHẢI bị chặn (fix bug)
  g = await prisma.grade.findUnique({ where: { submissionId: sub5Id } });
  r = await teacher.post(`/grades/submission/${sub5Id}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 9 },
      { criteriaId: f.criteria[1].id, score: 9 },
    ],
    version: g!.version,
    isDraft: false,
  });
  if (r.status === 400 && /Yêu cầu sửa/i.test(r.data?.message || '')) {
    ok('BE chặn GV chấm khi YEU_CAU_SUA → 400 message đúng');
  } else if (r.status === 200 || r.status === 201) {
    bad('REGRESSION: BE vẫn cho chấm khi YEU_CAU_SUA');
  } else {
    bad('GV chấm khi YEU_CAU_SUA → unexpected status', { status: r.status, data: r.data });
  }

  // Step 4: SV6 nộp đè (cho phép vì status=YEU_CAU_SUA)
  r = await sv6.post('/submissions/submit', {
    filePath: 'https://example.com/chain_v2.pdf',
    classId: f.clazz.id,
  });
  if ((r.status === 200 || r.status === 201) && r.data?.data?.status === 'DA_NOP') {
    ok(`Step 4: SV6 nộp lại OK → status=DA_NOP, version=${r.data.data.version}`);
  } else bad('SV nộp lại expected 2xx/DA_NOP', { status: r.status, data: r.data });

  // CLAIM #3 (chính): GV "Lưu nháp" lần 2 sau khi SV nộp lại — có lỗi không?
  g = await prisma.grade.findUnique({ where: { submissionId: sub5Id } });
  r = await teacher.post(`/grades/submission/${sub5Id}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 7 },
      { criteriaId: f.criteria[1].id, score: 7 },
    ],
    feedback: 'Bản nháp lần 2 sau khi SV nộp lại',
    version: g!.version,
    isDraft: true,
  });
  if (r.status === 200 || r.status === 201) {
    ok('Step 5: GV lưu nháp lại sau khi SV nộp lại → 2xx (KHÔNG bị khoá như user lo)');
  } else {
    bad('CONFIRMED BUG: GV không lưu nháp được sau khi SV nộp lại', { status: r.status, data: r.data });
  }

  // CLAIM #3 (cont): GV "Chấp nhận và gửi đi" (isDraft=false)
  g = await prisma.grade.findUnique({ where: { submissionId: sub5Id } });
  r = await teacher.post(`/grades/submission/${sub5Id}`, {
    rubricId: f.rubric.id,
    detailedScores: [
      { criteriaId: f.criteria[0].id, score: 8 },
      { criteriaId: f.criteria[1].id, score: 8 },
    ],
    feedback: 'Chốt điểm sau khi SV nộp lại',
    version: g!.version,
    isDraft: false,
  });
  if (r.status === 200 || r.status === 201) {
    ok('Step 6: GV chấp nhận & gửi đi → 2xx (KHÔNG bị khoá)');
    s = await prisma.submission.findUnique({ where: { id: sub5Id } });
    if (s?.status === 'CHO_DUYET') ok('BE: status đã chuyển CHO_DUYET sau "Chấp nhận & gửi đi"');
    else bad(`BE: status expected CHO_DUYET, got ${s?.status}`);
  } else {
    bad('CONFIRMED BUG: GV không submit grade chính thức được sau khi SV nộp lại', { status: r.status, data: r.data });
  }

  // ============================================================
  // Summary
  // ============================================================
  section('Tổng kết');
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  if (failed > 0) {
    console.log(`\nChi tiết fail:`);
    fails.forEach((f) => console.log(f));
  }
}

main()
  .catch((e) => {
    console.error('\nFATAL:', asErr(e));
    failed++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
